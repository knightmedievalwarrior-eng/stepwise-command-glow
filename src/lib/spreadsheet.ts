/**
 * Client-side spreadsheet engine (privacy-first).
 *
 * Excel / CSV files are parsed entirely in the browser with SheetJS.
 * Nothing is uploaded anywhere by this module — it only produces plain
 * table objects the UI can preview, clean and (optionally) push to the
 * user's own database in chunks.
 */
import * as XLSX from "xlsx";

export interface SheetTable {
  /** Sheet name (or file name for CSV). */
  name: string;
  columns: string[];
  rows: Record<string, string>[];
  meta: {
    fileName: string;
    size: number;
    parsedAt: number;
  };
}

export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export function isAcceptedFile(file: { name: string }): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Parse a workbook into one SheetTable per sheet. Runs fully client-side. */
export async function parseSpreadsheetFile(file: File): Promise<SheetTable[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  return wb.SheetNames.flatMap((name): SheetTable[] => {
    const sheet = wb.Sheets[name];
    if (!sheet) return [];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
    const headerRow = (matrix.shift() ?? []).map((c) => String(c ?? "").trim());
    const columns = headerRow.map((h, i) => (h ? h : `col${i + 1}`));
    const rows = matrix
      .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
      .map((r) => {
        const row: Record<string, string> = {};
        columns.forEach((col, i) => {
          row[col] = r[i] === undefined || r[i] === null ? "" : String(r[i]);
        });
        return row;
      });
    return [
      {
        name,
        columns,
        rows,
        meta: { fileName: file.name, size: file.size, parsedAt: Date.now() },
      },
    ];
  });
}

/* ------------------------------------------------------------------ */
/* Cleaning (all local, non-destructive: returns new table objects)     */
/* ------------------------------------------------------------------ */

export function trimWhitespace(table: SheetTable): SheetTable {
  return {
    ...table,
    columns: table.columns.map((c) => c.trim()),
    rows: table.rows.map((row) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) next[k.trim()] = typeof v === "string" ? v.trim() : v;
      return next;
    }),
  };
}

export function dropEmptyRows(table: SheetTable): { table: SheetTable; removed: number } {
  const rows = table.rows.filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
  return { table: { ...table, rows }, removed: table.rows.length - rows.length };
}

export function dropEmptyColumns(table: SheetTable): { table: SheetTable; removed: number } {
  const keep = table.columns.filter((c) => table.rows.some((r) => String(r[c] ?? "").trim() !== ""));
  const removed = table.columns.length - keep.length;
  const rows = table.rows.map((r) => {
    const next: Record<string, string> = {};
    for (const c of keep) next[c] = r[c] ?? "";
    return next;
  });
  return { table: { ...table, columns: keep, rows }, removed };
}

export function dedupeRows(table: SheetTable): { table: SheetTable; removed: number } {
  const seen = new Set<string>();
  const rows = table.rows.filter((r) => {
    const key = JSON.stringify(table.columns.map((c) => r[c] ?? ""));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { table: { ...table, rows }, removed: table.rows.length - rows.length };
}

export function removeColumn(table: SheetTable, column: string): SheetTable {
  const columns = table.columns.filter((c) => c !== column);
  const rows = table.rows.map((r) => {
    const next: Record<string, string> = {};
    for (const c of columns) next[c] = r[c] ?? "";
    return next;
  });
  return { ...table, columns, rows };
}

/* ------------------------------------------------------------------ */
/* Stats, chunking and payload budgeting (token/credit efficiency)      */
/* ------------------------------------------------------------------ */

export interface TableStats {
  rows: number;
  columns: number;
  emptyCells: number;
  duplicates: number;
  payloadBytes: number;
}

export function tableStats(table: SheetTable): TableStats {
  const keys = new Set<string>();
  let emptyCells = 0;
  let bytes = 2; // JSON array brackets
  for (const r of table.rows) {
    const key = JSON.stringify(table.columns.map((c) => r[c] ?? ""));
    if (keys.has(key)) keys.add("__dup__" + key);
    else keys.add(key);
    for (const c of table.columns) {
      const v = String(r[c] ?? "");
      if (!v.trim()) emptyCells += 1;
      bytes += c.length + v.length + 6;
    }
  }
  let duplicates = 0;
  for (const k of keys) if (k.startsWith("__dup__")) duplicates += 1;
  return {
    rows: table.rows.length,
    columns: table.columns.length,
    emptyCells,
    duplicates,
    payloadBytes: bytes,
  };
}

/** Rows per chunk — keeps each request small and cheap. */
export const CHUNK_ROWS = 200;
/** Hard byte budget per chunk (~512 KB) so huge cells never blow a request. */
export const CHUNK_BYTES = 512 * 1024;

/** Split rows into minimal, size-budgeted chunks before sending anywhere. */
export function chunkRows(rows: Record<string, string>[]): Record<string, string>[][] {
  const chunks: Record<string, string>[][] = [];
  let current: Record<string, string>[] = [];
  let bytes = 2;
  for (const row of rows) {
    const size = JSON.stringify(row).length + 1;
    if (current.length > 0 && (current.length >= CHUNK_ROWS || bytes + size > CHUNK_BYTES)) {
      chunks.push(current);
      current = [];
      bytes = 2;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Small, cheap summary of a table for AI prompts: column names, row count
 * and a few sample rows — never the full dataset.
 */
export function buildAiSample(table: SheetTable, sampleRows = 5) {
  return {
    fileName: table.meta.fileName,
    sheet: table.name,
    columns: table.columns,
    rowCount: table.rows.length,
    sample: table.rows.slice(0, sampleRows),
  };
}

/** Stable fingerprint for caching a parsed file in sessionStorage. */
export function fingerprint(meta: { fileName: string; size: number; parsedAt: number }): string {
  const raw = `${meta.fileName}::${meta.size}::${meta.parsedAt}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
