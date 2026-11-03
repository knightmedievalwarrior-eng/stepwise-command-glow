import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Broom,
  CheckCircle2,
  Copy,
  Download,
  Eraser,
  Loader2,
  RotateCcw,
  Rows3,
  Send,
  Table2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataDropzone } from "@/components/app/DataDropzone";
import { SupabaseSettingsDialog } from "@/components/app/SupabaseSettingsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dropDataset, storeDataset } from "@/lib/data-cache";
import { useT } from "@/lib/i18n";
import { useSupabaseConfig } from "@/lib/supabase-config";
import { pingSupabase, uploadRows, type UploadProgress } from "@/lib/supabase-rest";
import {
  dedupeRows,
  dropEmptyColumns,
  dropEmptyRows,
  fingerprint,
  isAcceptedFile,
  parseSpreadsheetFile,
  removeColumn,
  tableStats,
  trimWhitespace,
  type SheetTable,
} from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Studio — Excel & CSV, processed locally" },
      {
        name: "description",
        content: "อัปโหลด ดู และทำความสะอาดไฟล์ Excel/CSV ในเบราว์เซอร์ของคุณ 100% ส่งเข้า Supabase ของคุณเองได้",
      },
      { property: "og:title", content: "Data Studio — Excel & CSV, processed locally" },
      {
        property: "og:description",
        content: "ประมวลผลไฟล์ Excel/CSV ในเบราว์เซอร์โดยตรง ไม่ผ่านเซิร์ฟเวอร์",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataStudio,
});

const PREVIEW_ROWS = 50;

function DataStudio() {
  const { t, tr } = useT();
  const config = useSupabaseConfig();
  const [tables, setTables] = useState<SheetTable[]>([]);
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<SheetTable | null>(null);
  const [parsing, setParsing] = useState(false);
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const [destTable, setDestTable] = useState("");

  const table = tables[active];
  const stats = table ? tableStats(table) : null;
  const connected = Boolean(config.url && config.apiKey);

  const openFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!isAcceptedFile(file)) {
      toast.error(t("รองรับเฉพาะไฟล์ .xlsx .xls .csv", "Only .xlsx .xls .csv files are supported"));
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.every((p) => p.rows.length === 0)) {
        toast.error(t("ไม่พบข้อมูลในไฟล์นี้", "No data found in this file"));
        return;
      }
      storeDataset(parsed);
      setTables(parsed);
      setActive(0);
      setPrev(null);
      setDestTable(suggestTable(file.name, parsed[0].name));
      toast.success(
        t(`อ่านไฟล์สำเร็จ · ${parsed[0].rows.length} แถว`, `Parsed · ${parsed[0].rows.length} rows`),
        { description: t("ประมวลผลในเบราว์เซอร์นี้ 100%", "Processed 100% in this browser") },
      );
    } catch {
      toast.error(t("อ่านไฟล์ไม่สำเร็จ — ตรวจสอบว่าไฟล์เปิดได้และไม่เสียหาย", "Couldn't read the file — make sure it opens and isn't corrupted"));
    } finally {
      setParsing(false);
    }
  };

  const closeFile = () => {
    if (table) dropDataset(fingerprint(table.meta));
    setTables([]);
    setPrev(null);
    setUpload(null);
  };

  /** Apply a cleaning op with single-step undo. */
  const apply = (label: string, next: SheetTable) => {
    if (!table) return;
    setPrev(table);
    setTables(tables.map((tb, i) => (i === active ? next : tb)));
    toast.success(label);
  };

  const setActiveSheet = (i: number) => {
    setActive(i);
    setPrev(null);
  };

  const doUpload = async () => {
    if (!table || !config.url || !config.apiKey) return;
    const target = (destTable.trim() || config.table.trim() || "records").replace(/[^\w-]/g, "");
    setUpload({ chunk: 0, totalChunks: 0, inserted: 0 });
    const check = await pingSupabase(config, target);
    if (!check.ok) {
      setUpload(null);
      toast.error(t("เชื่อมต่อไม่สำเร็จ", "Connection failed"), { description: check.message });
      return;
    }
    const result = await uploadRows(config, target, table.rows, setUpload);
    setUpload(null);
    if (result.ok) {
      toast.success(
        t(`ส่ง ${result.inserted} แถวเข้า ${target} สำเร็จ`, `Sent ${result.inserted} rows to ${target}`),
        { description: t(`แบ่งส่ง ${result.chunks} ชุดย่อย จากเบราว์เซอร์โดยตรง`, `${result.chunks} chunk(s), direct from the browser`) },
      );
    } else {
      toast.error(t("ส่งข้อมูลไม่สำเร็จ", "Upload failed"), { description: result.message });
    }
  };

  return (
    <div className="relative">
      <div className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-64 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("กลับ Command Center", "Back to Command Center")}
        </Link>
        <section className="mt-4 max-w-3xl">
          <p className="eyebrow">Data Studio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("จัดการไฟล์ Excel / CSV ในเครื่องคุณ", "Work your Excel / CSV files locally")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t(
              "อัปโหลด ดูตัวอย่าง และทำความสะอาดข้อมูลแบบตารางได้ทันที — ทุกอย่างประมวลผลในเบราว์เซอร์ของคุณ ไม่มีการเก็บไฟล์บนเซิร์ฟเวอร์",
              "Upload, preview and clean tabular data instantly — everything is processed in your browser, with no server storage at all",
            )}
          </p>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {parsing ? (
              <div className="surface flex items-center gap-3 p-8 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" /> {t("กำลังอ่านไฟล์…", "Reading file…")}
              </div>
            ) : !table ? (
              <DataDropzone onFiles={(files) => void openFiles(files)} />
            ) : (
              <TablePreview
                table={table}
                tables={tables}
                active={active}
                onActive={setActiveSheet}
                stats={stats}
                prev={prev}
                onUndo={() => {
                  if (!prev) return;
                  setTables(tables.map((tb, i) => (i === active ? prev : tb)));
                  setPrev(null);
                }}
                onTrim={() => apply(t("ตัดช่องว่างส่วนเกินแล้ว", "Whitespace trimmed"), trimWhitespace(table))}
                onDropEmptyRows={() => {
                  const r = dropEmptyRows(table);
                  if (r.removed === 0) toast(t("ไม่มีแถวว่างอยู่แล้ว", "No empty rows to remove"));
                  else apply(t(`ลบแถวว่าง ${r.removed} แถว`, `Removed ${r.removed} empty row(s)`), r.table);
                }}
                onDropEmptyCols={() => {
                  const r = dropEmptyColumns(table);
                  if (r.removed === 0) toast(t("ไม่มีคอลัมน์ว่างอยู่แล้ว", "No empty columns to remove"));
                  else apply(t(`ลบคอลัมน์ว่าง ${r.removed} คอลัมน์`, `Removed ${r.removed} empty column(s)`), r.table);
                }}
                onDedupe={() => {
                  const r = dedupeRows(table);
                  if (r.removed === 0) toast(t("ไม่พบข้อมูลซ้ำ", "No duplicate rows found"));
                  else apply(t(`ลบข้อมูลซ้ำ ${r.removed} แถว`, `Removed ${r.removed} duplicate row(s)`), r.table);
                }}
                onDropCol={(col) => apply(t(`ลบคอลัมน์ ${col}`, `Removed column ${col}`), removeColumn(table, col))}
                onClose={closeFile}
              />
            )}
          </div>

          <aside className="space-y-6">
            <section className="surface space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Download className="size-4 text-muted-foreground" />
                {t("ส่งข้อมูลเข้าฐานข้อมูล", "Send to database")}
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(
                  "ส่งตรงจากเบราว์เซอร์ไปยัง Supabase ของคุณ แบ่งเป็นชุดย่อยเพื่อไม่ให้ payload ใหญ่หรือชน rate limit",
                  "Sent straight from your browser to your own Supabase in small chunks, so payloads stay small and rate limits are never hit",
                )}
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
                <span className={cn("size-1.5 shrink-0 rounded-full", connected ? "bg-success" : "bg-muted-foreground/50")} />
                {connected
                  ? t(`เชื่อมกับ Supabase แล้ว`, "Supabase connected")
                  : t("ยังไม่ได้เชื่อม Supabase (ไม่บังคับ)", "Supabase not connected (optional)")}
              </div>
              <SupabaseSettingsDialog
                trigger={
                  <Button type="button" variant="outline" size="sm" className="w-full">
                    {connected ? t("ตั้งค่าการเชื่อมต่อ", "Connection settings") : t("เชื่อม Supabase", "Connect Supabase")}
                  </Button>
                }
              />
              {table && connected && (
                <div className="space-y-2 border-t border-border pt-3">
                  <Label htmlFor="dest-table" className="text-xs">
                    {t("ตารางปลายทาง", "Destination table")}
                  </Label>
                  <Input
                    id="dest-table"
                    value={destTable}
                    onChange={(e) => setDestTable(e.target.value)}
                    placeholder="records"
                    className="font-mono text-sm"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {upload ? (
                    <div className="space-y-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-signal transition-all"
                          style={{ width: `${upload.totalChunks ? Math.round((upload.chunk / upload.totalChunks) * 100) : 20}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(`ส่งชุดที่ ${upload.chunk}/${upload.totalChunks} · ${upload.inserted} แถว`, `Chunk ${upload.chunk}/${upload.totalChunks} · ${upload.inserted} rows`)}
                      </p>
                    </div>
                  ) : (
                    <Button type="button" variant="signal" size="sm" className="w-full" onClick={() => void doUpload()}>
                      <Send /> {t(`ส่ง ${table.rows.length} แถว`, `Send ${table.rows.length} rows`)}
                    </Button>
                  )}
                </div>
              )}
            </section>

            <section className="surface space-y-2 p-5 text-xs leading-relaxed text-muted-foreground">
              <h2 className="text-sm font-semibold text-foreground">{t("เป็นส่วนตัวอย่างไร", "How privacy works")}</h2>
              <p>{t("ไฟล์ถูกเปิดด้วย SheetJS ในเบราว์เซอร์ของคุณ — ไม่มีการอัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์ใดๆ", "Your file is opened with SheetJS inside your browser — the file itself is never uploaded to any server")}</p>
              <p>{t("สำเนาชั่วคราวเก็บใน sessionStorage ของแท็บนี้ และถูกลบเมื่อปิดแท็บ", "A temporary copy is kept in this tab's sessionStorage and deleted when the tab closes")}</p>
              <p>{t("ถ้าเชื่อม Supabase ข้อมูลจะส่งตรงจากเบราว์เซอร์ไปยังโปรเจกต์ของคุณเท่านั้น", "With Supabase connected, data goes only from your browser to your own project")}</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function suggestTable(fileName: string, sheet: string): string {
  const base = fileName.replace(/\.(xlsx|xls|csv)$/i, "").toLowerCase();
  const clean = `${base}_${sheet}`.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_").slice(0, 40);
  return clean || "records";
}

function TablePreview(props: {
  table: SheetTable;
  tables: SheetTable[];
  active: number;
  onActive: (i: number) => void;
  stats: ReturnType<typeof tableStats> | null;
  prev: SheetTable | null;
  onUndo: () => void;
  onTrim: () => void;
  onDropEmptyRows: () => void;
  onDropEmptyCols: () => void;
  onDedupe: () => void;
  onDropCol: (col: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const { table, stats } = props;

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <Table2 className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{table.meta.fileName}</span>
        {props.tables.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {props.tables.map((tb, i) => (
              <button
                key={tb.name}
                type="button"
                onClick={() => props.onActive(i)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  i === props.active ? "border-signal bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {tb.name}
              </button>
            ))}
          </div>
        )}
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={props.onClose}>
          {t("ปิดไฟล์", "Close file")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-3">
        <Button type="button" variant="outline" size="sm" onClick={props.onTrim}>
          <Eraser /> {t("ตัดช่องว่าง", "Trim")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onDropEmptyRows}>
          <Rows3 /> {t("ลบแถวว่าง", "Empty rows")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onDropEmptyCols}>
          <Broom /> {t("ลบคอลัมน์ว่าง", "Empty columns")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onDedupe}>
          <Copy /> {t("ลบข้อมูลซ้ำ", "Duplicates")}
        </Button>
        {props.prev && (
          <Button type="button" variant="ghost" size="sm" onClick={props.onUndo}>
            <RotateCcw /> {t("ย้อนกลับ", "Undo")}
          </Button>
        )}
      </div>

      {stats && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
          <span>{t(`${stats.rows} แถว`, `${stats.rows} rows`)}</span>
          <span>{t(`${stats.columns} คอลัมน์`, `${stats.columns} columns`)}</span>
          {stats.emptyCells > 0 && <span>{t(`ช่องว่าง ${stats.emptyCells}`, `${stats.emptyCells} empty cells`)}</span>}
          {stats.duplicates > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <TriangleAlert className="size-3" /> {t(`ซ้ำ ${stats.duplicates} แถว`, `${stats.duplicates} duplicates`)}
            </span>
          )}
          <span>~{Math.round(stats.payloadBytes / 1024)} KB JSON</span>
        </div>
      )}

      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th className="w-10 border-b border-border px-3 py-2 text-right font-normal text-muted-foreground">#</th>
              {table.columns.map((col) => (
                <th key={col} className="border-b border-border px-3 py-2 text-left font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
              <tr key={i} className="odd:bg-background even:bg-secondary/30">
                <td className="px-3 py-1.5 text-right text-muted-foreground/60">{i + 1}</td>
                {table.columns.map((col) => (
                  <td key={col} className="max-w-52 truncate px-3 py-1.5" title={row[col]}>
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > PREVIEW_ROWS && (
        <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
          {t(`แสดง ${PREVIEW_ROWS} แถวแรก จากทั้งหมด ${table.rows.length} แถว`, `First ${PREVIEW_ROWS} of ${table.rows.length} rows`)}
        </p>
      )}

      {stats && stats.duplicates > 0 && (
        <div className="flex items-start gap-2 border-t border-border bg-warn/5 px-5 py-3 text-xs text-warn">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          {t("กด “ลบข้อมูลซ้ำ” เพื่อลบแถวที่ซ้ำกันทุกคอลัมน์ก่อนส่งเข้าฐานข้อมูล", "Use “Duplicates” to remove rows identical across every column before sending to the database")}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-2.5">
        {table.columns.map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => props.onDropCol(col)}
            className="rounded-full border border-border px-2 py-0.5 text-[0.7rem] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            {col} ×
          </button>
        ))}
      </div>
    </div>
  );
}
