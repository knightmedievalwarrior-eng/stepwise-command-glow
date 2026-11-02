/**
 * Supabase connection settings, kept in this browser only (localStorage).
 * Holds the user's own project credentials — never task or customer data.
 * All pushes to Supabase happen directly from the browser (client → user's
 * Supabase); nothing passes through this app's server.
 */
import { useSyncExternalStore } from "react";

export interface SupabaseConfig {
  /** Project URL, e.g. https://abcd.supabase.co */
  url: string;
  /** Publishable key (sb_publishable_…) or legacy anon JWT. */
  apiKey: string;
  /** Default destination table for uploaded rows. */
  table: string;
}

export const SUPABASE_CONFIG_KEY = "gtr.supabase.v1";
const EMPTY: SupabaseConfig = { url: "", apiKey: "", table: "" };

let cache: SupabaseConfig | null = null;
const listeners = new Set<() => void>();

function read(): SupabaseConfig {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = JSON.parse(window.localStorage.getItem(SUPABASE_CONFIG_KEY) ?? "null") as Partial<SupabaseConfig> | null;
    cache = {
      url: typeof raw?.url === "string" ? raw.url : "",
      apiKey: typeof raw?.apiKey === "string" ? raw.apiKey : "",
      table: typeof raw?.table === "string" ? raw.table : "",
    };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

export function getSupabaseConfig(): SupabaseConfig {
  return read();
}

export function saveSupabaseConfig(next: SupabaseConfig) {
  cache = { url: next.url.trim().replace(/\/+$/, ""), apiKey: next.apiKey.trim(), table: next.table.trim() };
  if (typeof window !== "undefined") {
    const empty = !cache.url && !cache.apiKey;
    if (empty) window.localStorage.removeItem(SUPABASE_CONFIG_KEY);
    else window.localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(cache));
  }
  listeners.forEach((l) => l());
}

export function useSupabaseConfig(): SupabaseConfig {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}

/** Returns a Thai/English error message, or null when the config looks usable. */
export function validateSupabaseConfig(
  cfg: { url: string; apiKey: string },
  lang: "th" | "en" = "th",
): string | null {
  const m = (th: string, en: string) => (lang === "en" ? en : th);
  let u: URL;
  try {
    u = new URL(cfg.url.trim());
  } catch {
    return m("รูปแบบ URL ไม่ถูกต้อง", "Invalid URL");
  }
  if (u.protocol !== "https:")
    return m("ต้องขึ้นต้นด้วย https://", "Must start with https://");
  if (!cfg.apiKey.trim())
    return m("กรุณาใส่ API Key (Publishable / anon key)", "Enter the API key (publishable / anon key)");
  return null;
}

/** Project ref from a Supabase URL, for display only. */
export function projectRef(url: string): string {
  try {
    return new URL(url).host.replace(/\.supabase\.(co|in)$/, "");
  } catch {
    return url;
  }
}

/** Test helper. */
export function __resetSupabaseConfigForTests() {
  cache = null;
}
