import { beforeEach, describe, expect, it } from "vitest";

import { __resetDatasetCacheForTests, cachedSample, cachedTables, dropDataset, storeDataset } from "@/lib/data-cache";
import {
  buildAiSample,
  chunkRows,
  dedupeRows,
  dropEmptyColumns,
  dropEmptyRows,
  fingerprint,
  isAcceptedFile,
  parseSpreadsheetFile,
  tableStats,
  trimWhitespace,
} from "@/lib/spreadsheet";
import { __resetSupabaseConfigForTests, getSupabaseConfig, saveSupabaseConfig, validateSupabaseConfig } from "@/lib/supabase-config";
import { restUrl } from "@/lib/supabase-rest";
import { CHUNK_BYTES, CHUNK_ROWS } from "@/lib/spreadsheet";

const CSV = `name,email,amount
Somchai Jaidee,somchai@example.com,1200
Suda ,suda@example.com,
,Suda P.,500
Suda P.,suda@example.com,500
`;

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: "text/csv" });
}

describe("spreadsheet parsing (client-side)", () => {
  it("parses a CSV entirely from a local File object", async () => {
    const tables = await parseSpreadsheetFile(makeFile("customers.csv", CSV));
    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toEqual(["name", "email", "amount"]);
    expect(tables[0].rows).toHaveLength(4);
    expect(tables[0].rows[0].name).toBe("Somchai Jaidee");
  });

  it("accepts only spreadsheet extensions", () => {
    expect(isAcceptedFile({ name: "a.xlsx" })).toBe(true);
    expect(isAcceptedFile({ name: "a.xls" })).toBe(true);
    expect(isAcceptedFile({ name: "a.csv" })).toBe(true);
    expect(isAcceptedFile({ name: "a.pdf" })).toBe(false);
  });
});

describe("cleaning", () => {
  it("trims whitespace", async () => {
    const parsed = await parseSpreadsheetFile(makeFile("a.csv", CSV));
    const trimmed = trimWhitespace(parsed[0]);
    expect(trimmed.rows[1].name).toBe("Suda");
  });

  it("removes fully empty rows only", async () => {
    const parsed = await parseSpreadsheetFile(makeFile("a.csv", "a,b\n1,2\n,\n3,4\n"));
    const { table, removed } = dropEmptyRows(parsed[0]);
    expect(removed).toBe(1);
    expect(table.rows).toHaveLength(2);
  });

  it("removes fully empty columns only", async () => {
    const parsed = await parseSpreadsheetFile(makeFile("a.csv", "a,b,c\n1,2,\n3,4,\n"));
    const { table, removed } = dropEmptyColumns(parsed[0]);
    expect(removed).toBe(1);
    expect(table.columns).toEqual(["a", "b"]);
  });

  it("removes duplicate rows and reports the count", async () => {
    const parsed = await parseSpreadsheetFile(makeFile("a.csv", "a,b\n1,2\n1,2\n1,3\n"));
    const { table, removed } = dedupeRows(parsed[0]);
    expect(removed).toBe(1);
    expect(table.rows).toHaveLength(2);
  });

  it("counts duplicates and empty cells in stats", async () => {
    const parsed = await parseSpreadsheetFile(makeFile("a.csv", CSV));
    const stats = tableStats(parsed[0]);
    expect(stats.rows).toBe(4);
    expect(stats.emptyCells).toBeGreaterThan(0);
    expect(stats.duplicates).toBe(1);
  });
});

describe("chunking (token/credit efficiency)", () => {
  const big = Array.from({ length: 950 }, (_, i) => ({ id: String(i), note: "x".repeat(40) }));

  it("splits rows into chunks of at most the configured row limit", () => {
    const chunks = chunkRows(big);
    expect(chunks.length).toBe(Math.ceil(950 / CHUNK_ROWS));
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_ROWS);
      expect(JSON.stringify(chunk).length).toBeLessThan(CHUNK_BYTES);
    }
    expect(chunks.flat()).toHaveLength(950);
  });

  it("builds a minimal AI sample instead of the full dataset", async () => {
    const parsed = await parseSpreadsheetFile(makeFile("big.csv", "a\n" + Array.from({ length: 500 }, (_, i) => i).join("\n")));
    const sample = buildAiSample(parsed[0], 5);
    expect(sample.rowCount).toBe(500);
    expect(sample.sample).toHaveLength(5);
    expect(JSON.stringify(sample).length).toBeLessThan(JSON.stringify(parsed[0].rows).length / 10);
  });
});

describe("local dataset cache (sessionStorage, browser only)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    __resetDatasetCacheForTests();
  });

  it("caches and returns parsed tables by fingerprint", async () => {
    const parsed = await parseSpreadsheetFile(makeFile("a.csv", CSV));
    const fp = fingerprint(parsed[0].meta);
    storeDataset(parsed);
    expect(cachedTables(fp)?.[0].rows).toHaveLength(4);
    expect(cachedSample(fp)?.rowCount).toBe(4);
    dropDataset(fp);
    expect(cachedTables(fp)).toBeUndefined();
  });
});

describe("supabase config (kept in this browser only)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetSupabaseConfigForTests();
  });

  it("requires https and an api key", () => {
    expect(validateSupabaseConfig({ url: "abc", apiKey: "k" })).toMatch(/https/);
    expect(validateSupabaseConfig({ url: "https://x.supabase.co", apiKey: "" })).toBeTruthy();
    expect(validateSupabaseConfig({ url: "https://x.supabase.co", apiKey: "k" })).toBeNull();
  });

  it("saves and clears config without exposing it anywhere else", () => {
    saveSupabaseConfig({ url: "https://x.supabase.co/", apiKey: "k", table: "records" });
    expect(getSupabaseConfig()).toEqual({ url: "https://x.supabase.co", apiKey: "k", table: "records" });
    saveSupabaseConfig({ url: "", apiKey: "", table: "" });
    expect(getSupabaseConfig()).toEqual({ url: "", apiKey: "", table: "" });
  });

  it("builds a PostgREST URL without a trailing double slash", () => {
    expect(restUrl({ url: "https://x.supabase.co", apiKey: "k", table: "records" }, "rows")).toBe(
      "https://x.supabase.co/rest/v1/rows",
    );
  });
});
