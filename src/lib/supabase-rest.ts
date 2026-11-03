/**
 * Direct browser → user's Supabase REST (PostgREST) access.
 * No server in between: rows leave the browser straight for the user's own
 * project, in small, budgeted chunks to avoid rate limits and big payloads.
 */
import { CHUNK_BYTES, chunkRows } from "./spreadsheet";
import type { SupabaseConfig } from "./supabase-config";

export interface UploadProgress {
  chunk: number;
  totalChunks: number;
  inserted: number;
}

export type UploadOutcome =
  | { ok: true; inserted: number; chunks: number }
  | { ok: false; inserted: number; message: string };

function headers(cfg: SupabaseConfig): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: cfg.apiKey,
  };
  // Legacy anon JWTs use Bearer auth; opaque sb_publishable_ keys use apikey.
  if (cfg.apiKey.startsWith("eyJ")) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
}

export function restUrl(cfg: SupabaseConfig, table: string): string {
  const base = cfg.url.trim().replace(/\/+$/, "");
  return `${base}/rest/v1/${encodeURIComponent(table)}`;
}

/** Cheap connectivity + table check without sending any data. */
export async function pingSupabase(cfg: SupabaseConfig, table: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${restUrl(cfg, table)}?select=*&limit=1`, {
      method: "GET",
      headers: { ...headers(cfg), Accept: "application/json" },
    });
    if (res.ok) return { ok: true, message: `HTTP ${res.status}` };
    if (res.status === 404)
      return { ok: false, message: `HTTP 404 · table "${table}" not found (check the table name)` };
    if (res.status === 401 || res.status === 403)
      return { ok: false, message: `HTTP ${res.status} · access denied (check the API key / RLS policies)` };
    const body = await res.text();
    return { ok: false, message: `HTTP ${res.status}${body ? ` · ${body.slice(0, 160)}` : ""}` };
  } catch {
    return {
      ok: false,
      message: "Can't reach the project — check the URL and that CORS/browser access is allowed",
    };
  }
}

/** Upload rows in minimal chunks; reports progress per chunk. */
export async function uploadRows(
  cfg: SupabaseConfig,
  table: string,
  rows: Record<string, string>[],
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadOutcome> {
  const chunks = chunkRows(rows);
  let inserted = 0;
  for (const [i, chunk] of chunks.entries()) {
    const bytes = JSON.stringify(chunk).length;
    if (bytes > CHUNK_BYTES) {
      // A single chunk should already respect the budget; guard anyway.
      return { ok: false, inserted, message: "Chunk too large — clean the data (e.g. remove wide columns) and retry" };
    }
    onProgress?.({ chunk: i + 1, totalChunks: chunks.length, inserted });
    try {
      const res = await fetch(`${restUrl(cfg, table)}`, {
        method: "POST",
        headers: { ...headers(cfg), Prefer: "return=minimal" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const body = await res.text();
        const reason =
          res.status === 401 || res.status === 403
            ? "access denied (check the API key and RLS insert policy)"
            : res.status === 404
              ? `table "${table}" not found`
              : `HTTP ${res.status}`;
        return { ok: false, inserted, message: `${reason}${body ? ` · ${body.slice(0, 160)}` : ""}` };
      }
      inserted += chunk.length;
      onProgress?.({ chunk: i + 1, totalChunks: chunks.length, inserted });
    } catch {
      return { ok: false, inserted, message: "Connection lost mid-upload — the chunk was not saved, retry to continue" };
    }
  }
  return { ok: true, inserted, chunks: chunks.length };
}
