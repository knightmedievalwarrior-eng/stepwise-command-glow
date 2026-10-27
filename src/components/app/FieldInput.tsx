import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  calcQuotation,
  formatBaht,
  readBool,
  readItems,
  readNumber,
  readString,
  type FieldDef,
  type QuoteItem,
  type TaskData,
} from "@/lib/tasks/definitions";

interface Props {
  field: FieldDef;
  data: TaskData;
  error: string | undefined;
  onChange: (name: string, value: unknown) => void;
}

export function FieldInput({ field, data, error, onChange }: Props) {
  const { t, tr } = useT();
  const id = `f-${field.name}`;
  const wide = !field.half || field.type === "textarea" || field.type === "items";

  if (field.type === "items") {
    return (
      <div className="sm:col-span-2">
        <ItemsEditor data={data} onChange={(items) => onChange("items", items)} />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "switch") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3 sm:col-span-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {tr(field.label)}
        </Label>
        <Switch id={id} checked={readBool(data, field.name)} onCheckedChange={(v) => onChange(field.name, v)} />
      </div>
    );
  }

  const value = readString(data, field.name);
  const invalid = Boolean(error);

  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={id} className="text-sm font-medium">
        {tr(field.label)}
        {field.required && <span className="ml-0.5 text-signal">*</span>}
      </Label>
      {field.type === "select" ? (
        <Select value={value} onValueChange={(v) => onChange(field.name, v)}>
          <SelectTrigger id={id} aria-invalid={invalid} className="h-11 bg-card">
            <SelectValue placeholder={t("เลือก…", "Select…")} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {tr(o.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          placeholder={tr(field.placeholder)}
          aria-invalid={invalid}
          rows={3}
          className="bg-card"
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "text" : field.type}
          inputMode={field.type === "number" ? "decimal" : field.type === "tel" ? "tel" : undefined}
          value={value}
          placeholder={tr(field.placeholder)}
          aria-invalid={invalid}
          className="h-11 bg-card"
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      )}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : field.hint ? (
        <p className="text-xs text-muted-foreground">{tr(field.hint)}</p>
      ) : null}
    </div>
  );
}

function ItemsEditor({ data, onChange }: { data: TaskData; onChange: (items: QuoteItem[]) => void }) {
  const { t } = useT();
  const items = readItems(data);
  const totals = calcQuotation(items, readNumber(data, "discount"), readBool(data, "vat"));
  const update = (i: number, patch: Partial<QuoteItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_80px_120px_110px_32px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
        <span>{t("รายการ", "Item")}</span>
        <span>{t("จำนวน", "Qty")}</span>
        <span>{t("ราคา/หน่วย", "Unit price")}</span>
        <span className="text-right">{t("รวม", "Total")}</span>
        <span />
      </div>
      {items.map((it, i) => (
        <div
          key={i}
          className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/40 p-3 sm:grid-cols-[1fr_80px_120px_110px_32px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
        >
          <Input
            aria-label={t(`ชื่อรายการที่ ${i + 1}`, `Item ${i + 1} name`)}
            value={it.name}
            placeholder={t("ชื่อสินค้า / บริการ", "Product / service")}
            className="col-span-2 h-10 bg-card sm:col-span-1"
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <Input
            aria-label={t("จำนวน", "Quantity")}
            inputMode="numeric"
            value={it.qty ? String(it.qty) : ""}
            placeholder="1"
            className="h-10 bg-card"
            onChange={(e) => update(i, { qty: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
          />
          <Input
            aria-label={t("ราคาต่อหน่วย", "Unit price")}
            inputMode="decimal"
            value={it.price ? String(it.price) : ""}
            placeholder="0.00"
            className="h-10 bg-card"
            onChange={(e) => update(i, { price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
          />
          <span className="self-center text-right font-mono text-sm tabular-nums">
            {formatBaht(it.qty * it.price)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("ลบรายการ", "Remove item")}
            disabled={items.length <= 1}
            className="justify-self-end"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { name: "", qty: 1, price: 0 }])}
      >
        <Plus /> {t("เพิ่มรายการ", "Add item")}
      </Button>
      <div className="flex items-center justify-between border-t border-dashed border-border pt-3 text-sm">
        <span className="text-muted-foreground">{t("ยอดรวมก่อนส่วนลด", "Subtotal before discount")}</span>
        <span className="font-mono font-medium tabular-nums">{formatBaht(totals.subtotal)}</span>
      </div>
    </div>
  );
}
