/**
 * Local dataset cache (sessionStorage) — part of the token/credit
 * efficiency layer. Parsed tables and AI-ready samples are cached in the
 * browser only, so re-processing the same file never re-parses or re-sends
 * more than the minimal necessary payload. Cleared when the tab closes.
 */
import { buildAiSample, fingerprint, type SheetTable } from "./spreadsheet";

const CACHE_KEY = "gtr.dataset-cache.v1";
const MAX_FILES = 3;
/** Don't cache datasets larger than ~2 MB of JSON. */
const MAX_DATASET_BYTES = 2 * 1024 * 1024;

interface CacheEntry {
  fp: string;
  tables: SheetTable[];
  sample: ReturnType<typeof buildAiSample>;
  cachedAt: number;
}

interface CacheShape {
  order: string[];
  entries: Record<string, CacheEntry>;
}

let cache: CacheShape | null = null;
const listeners = new Set<() => void>();

function read(): CacheShape {
  if (cache) return cache;
  if (typeof window === "undefined") return { order: [], entries: {} };
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) ?? "null") as CacheShape | null;
    cache = raw && Array.isArray(raw.order) && raw.entries ? raw : { order: [], entries: {} };
  } catch {
    cache = { order: [], entries: {} };
  }
  return cache;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded — drop the oldest file and retry once.
    const shape = read();
    if (shape.order.length > 1) {
      const [oldest] = shape.order;
      shape.order = shape.order.slice(1);
      delete shape.entries[oldest];
      cache = shape;
      try {
        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(shape));
      } catch {
        window.sessionStorage.removeItem(CACHE_KEY);
      }
      listeners.forEach((l) => l());
      return;
    }
    window.sessionStorage.removeItem(CACHE_KEY);
  }
}

function setState(next: CacheShape) {
  cache = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDatasetCache(): CacheShape {
  return useSyncExternalStore(subscribe, read, () => ({ order: [], entries: {} }));
}

export function cachedTables(fp: string): SheetTable[] | undefined {
  const shape = read();
  return shape.entries[fp]?.tables;
}

/** Cache a parsed dataset (browser only, size-capped). */
export function storeDataset(tables: SheetTable[]) {
  if (tables.length === 0) return;
  const fp = fingerprint(tables[0].meta);
  const entry: CacheEntry = { fp, tables, sample: buildAiSample(tables[0]), cachedAt: Date.now() };
  const shape = read();
  if (JSON.stringify(entry).length > MAX_DATASET_BYTES) return; // too big — skip caching, parse on demand
  const order = [fp, ...shape.order.filter((k) => k !== fp)].slice(0, MAX_FILES);
  const entries = { ...shape.entries };
  for (const k of shape.order) if (!order.includes(k)) delete entries[k];
  entries[fp] = entry;
  setState({ order, entries });
}

export function dropDataset(fp: string) {
  const shape = read();
  if (!shape.entries[fp]) return;
  const entries = { ...shape.entries };
  delete entries[fp];
  setState({ order: shape.order.filter((k) => k !== fp), entries });
}

export function clearDatasetCache() {
  setState({ order: [], entries: {} });
}

/** The minimal payload an AI model would ever need for a cached file. */
export function cachedSample(fp: string): CacheEntry["sample"] | undefined {
  const shape = read();
  return shape.entries[fp]?.sample;
}

/** Test helper. */
export function __resetDatasetCacheForTests() {
  cache = null;
}
