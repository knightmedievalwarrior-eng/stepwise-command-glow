/**
 * Drag-and-drop upload zone for Excel / CSV files.
 * Files are handed to the caller untouched — parsing happens locally.
 */
import { UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { isAcceptedFile } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";

export function DataDropzone({ onFiles, busy }: { onFiles: (files: File[]) => void; busy?: boolean }) {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (files: File[]) => onFiles(files.filter(isAcceptedFile));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    accept(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={busy}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!busy && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
      }}
      className={cn(
        "surface flex cursor-pointer flex-col items-center justify-center gap-3 px-6 py-12 text-center transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
        dragging ? "border-signal bg-signal/5 shadow-lift" : "hover:border-signal/40",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="sr-only"
        onChange={(e) => {
          accept(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-2xl bg-secondary transition-colors",
          dragging ? "bg-signal text-signal-foreground" : "text-muted-foreground",
        )}
      >
        <UploadCloud className="size-6" />
      </span>
      <div>
        <p className="font-medium">
          {t("ลากไฟล์ Excel / CSV มาวางที่นี่", "Drag an Excel / CSV file here")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("หรือคลิกเพื่อเลือกไฟล์ · .xlsx .xls .csv", "or click to browse · .xlsx .xls .csv")}
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t("ไฟล์ถูกเปิดและประมวลผลในเบราว์เซอร์นี้เท่านั้น — ไม่มีการอัปโหลดขึ้นเซิร์ฟเวอร์", "The file is opened and processed in this browser only — nothing is uploaded to a server")}
      </p>
      <Button type="button" variant="outline" size="sm" tabIndex={-1}>
        {t("เลือกไฟล์", "Choose file")}
      </Button>
    </div>
  );
}
