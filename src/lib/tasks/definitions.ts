import { FileText, ReceiptText, UserPlus, type LucideIcon } from "lucide-react";

import { tx, type Lang, type Text } from "../i18n";

export type TaskType = "quotation" | "customer" | "document";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "switch"
  | "items";

export interface FieldOption {
  value: string;
  label: Text;
}

export interface FieldDef {
  name: string;
  label: Text;
  type: FieldType;
  required?: boolean;
  placeholder?: Text | string;
  hint?: Text;
  options?: FieldOption[];
  /** Occupies half the row on wide screens. */
  half?: boolean;
}

export interface StepDef {
  id: string;
  title: Text;
  description: Text;
  fields: FieldDef[];
}

export interface QuoteItem {
  name: string;
  qty: number;
  price: number;
}

export type TaskData = Record<string, unknown>;

export interface TaskDef {
  type: TaskType;
  title: Text;
  verb: Text;
  description: Text;
  icon: LucideIcon;
  refPrefix: string;
  steps: StepDef[];
  defaults: () => TaskData;
  /** Bot pipeline shown on the execution screen. The Thai text is also sent to n8n. */
  pipeline: Text[];
  /** Non-personal label kept in the usage history after the data is destroyed. */
  historyLabel: (data: TaskData) => Text;
}

export const VAT_RATE = 0.07;

export function readString(data: TaskData, key: string): string {
  const v = data[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export function readNumber(data: TaskData, key: string): number {
  const v = data[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function readBool(data: TaskData, key: string): boolean {
  return data[key] === true;
}

export function readItems(data: TaskData): QuoteItem[] {
  const v = data["items"];
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      name: typeof r["name"] === "string" ? (r["name"] as string) : "",
      qty: Number(r["qty"]) || 0,
      price: Number(r["price"]) || 0,
    };
  });
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcQuotation(
  items: QuoteItem[],
  discountPercent: number,
  includeVat: boolean,
): QuoteTotals {
  const subtotal = round2(items.reduce((s, it) => s + Math.max(0, it.qty) * Math.max(0, it.price), 0));
  const pct = Math.min(100, Math.max(0, discountPercent));
  const discount = round2((subtotal * pct) / 100);
  const afterDiscount = round2(subtotal - discount);
  const vat = includeVat ? round2(afterDiscount * VAT_RATE) : 0;
  return { subtotal, discount, afterDiscount, vat, total: round2(afterDiscount + vat) };
}

export const formatBaht = (n: number) =>
  `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DOC_TYPES: FieldOption[] = [
  { value: "invoice", label: { th: "ใบแจ้งหนี้", en: "Invoice" } },
  { value: "receipt", label: { th: "ใบเสร็จรับเงิน", en: "Receipt" } },
  { value: "tax-invoice", label: { th: "ใบกำกับภาษี", en: "Tax invoice" } },
  { value: "po", label: { th: "ใบสั่งซื้อ", en: "Purchase order" } },
  { value: "other", label: { th: "อื่นๆ", en: "Other" } },
];

export const docTypeLabel = (v: string): Text => DOC_TYPES.find((d) => d.value === v)?.label ?? { th: v, en: v };

const L = (th: string, en: string): Text => ({ th, en });

export const TASKS: Record<TaskType, TaskDef> = {
  quotation: {
    type: "quotation",
    title: L("ออกใบเสนอราคา", "Create quotation"),
    verb: L("ใบเสนอราคา", "Quotation"),
    description: L("สร้างใบเสนอราคาพร้อมคำนวณส่วนลดและ VAT อัตโนมัติ", "Build a quotation with discount and VAT calculated for you"),
    icon: ReceiptText,
    refPrefix: "QT",
    defaults: () => ({
      items: [{ name: "", qty: 1, price: 0 }],
      discount: 0,
      vat: true,
      validDays: 30,
    }),
    steps: [
      {
        id: "customer",
        title: L("ข้อมูลลูกค้า", "Customer"),
        description: L("ระบุผู้รับใบเสนอราคา", "Who receives this quotation"),
        fields: [
          { name: "customerName", label: L("ชื่อลูกค้า / บริษัท", "Customer / company name"), type: "text", required: true, placeholder: L("เช่น บริษัท สยามเทค จำกัด", "e.g. Siam Tech Co., Ltd.") },
          { name: "contactName", label: L("ผู้ติดต่อ", "Contact person"), type: "text", half: true, placeholder: L("คุณสมชาย", "Mr. Somchai") },
          { name: "email", label: L("อีเมล", "Email"), type: "email", half: true, placeholder: "name@company.com" },
          { name: "phone", label: L("เบอร์โทร", "Phone"), type: "tel", half: true, placeholder: "08x-xxx-xxxx" },
          { name: "taxId", label: L("เลขผู้เสียภาษี", "Tax ID"), type: "text", half: true, placeholder: L("13 หลัก", "13 digits") },
        ],
      },
      {
        id: "items",
        title: L("รายการสินค้า / บริการ", "Products / services"),
        description: L("เพิ่มรายการ จำนวน และราคาต่อหน่วย", "Add items, quantities and unit prices"),
        fields: [{ name: "items", label: L("รายการ", "Items"), type: "items", required: true }],
      },
      {
        id: "terms",
        title: L("เงื่อนไข", "Terms"),
        description: L("ส่วนลด ภาษี และอายุใบเสนอราคา", "Discount, tax and validity"),
        fields: [
          { name: "discount", label: L("ส่วนลด (%)", "Discount (%)"), type: "number", half: true, placeholder: "0" },
          { name: "validDays", label: L("ยืนราคา (วัน)", "Valid for (days)"), type: "number", half: true, required: true, placeholder: "30" },
          { name: "vat", label: L("คิดภาษีมูลค่าเพิ่ม 7%", "Add 7% VAT"), type: "switch" },
          { name: "note", label: L("หมายเหตุ", "Notes"), type: "textarea", placeholder: L("เงื่อนไขการชำระเงิน การส่งมอบ ฯลฯ", "Payment terms, delivery, etc.") },
        ],
      },
    ],
    pipeline: [
      L("ตรวจสอบความถูกต้องของข้อมูล", "Validate the details"),
      L("คำนวณยอดรวม ส่วนลด และภาษี", "Calculate totals, discount and tax"),
      L("ออกเลขที่เอกสาร", "Issue a document number"),
      L("จัดทำไฟล์ใบเสนอราคา (PDF)", "Create the quotation file (PDF)"),
      L("ส่งเข้าระบบอัตโนมัติ", "Submit to the system"),
    ],
    historyLabel: (data) => {
      const items = readItems(data);
      const t = calcQuotation(items, readNumber(data, "discount"), readBool(data, "vat"));
      return L(`${items.length} รายการ · ${formatBaht(t.total)}`, `${items.length} item${items.length === 1 ? "" : "s"} · ${formatBaht(t.total)}`);
    },
  },
  customer: {
    type: "customer",
    title: L("ลงข้อมูลลูกค้า", "Add customer"),
    verb: L("ข้อมูลลูกค้า", "Customer record"),
    description: L("บันทึกลูกค้าใหม่เข้าระบบ CRM ทีละขั้นตอน", "Add a new customer to the CRM step by step"),
    icon: UserPlus,
    refPrefix: "CU",
    defaults: () => ({ customerType: "company" }),
    steps: [
      {
        id: "basic",
        title: L("ข้อมูลพื้นฐาน", "Basics"),
        description: L("ประเภทและชื่อลูกค้า", "Customer type and name"),
        fields: [
          {
            name: "customerType",
            label: L("ประเภทลูกค้า", "Customer type"),
            type: "select",
            required: true,
            options: [
              { value: "company", label: L("นิติบุคคล", "Company") },
              { value: "person", label: L("บุคคลธรรมดา", "Individual") },
            ],
          },
          { name: "name", label: L("ชื่อลูกค้า", "Customer name"), type: "text", required: true, placeholder: L("ชื่อ-นามสกุล หรือชื่อบริษัท", "Full name or company name") },
          { name: "taxId", label: L("เลขผู้เสียภาษี / บัตรประชาชน", "Tax ID / national ID"), type: "text", placeholder: L("13 หลัก", "13 digits") },
        ],
      },
      {
        id: "contact",
        title: L("ช่องทางติดต่อ", "Contact"),
        description: L("เบอร์โทรและอีเมล", "Phone and email"),
        fields: [
          { name: "phone", label: L("เบอร์โทร", "Phone"), type: "tel", required: true, half: true, placeholder: "08x-xxx-xxxx" },
          { name: "email", label: L("อีเมล", "Email"), type: "email", half: true, placeholder: "name@company.com" },
          { name: "line", label: L("LINE ID", "LINE ID"), type: "text", half: true, placeholder: "@line" },
        ],
      },
      {
        id: "address",
        title: L("ที่อยู่", "Address"),
        description: L("สำหรับออกเอกสารและจัดส่ง", "For documents and delivery"),
        fields: [
          { name: "address", label: L("ที่อยู่", "Address"), type: "textarea", placeholder: L("เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ", "Number, street, sub-district, district") },
          { name: "province", label: L("จังหวัด", "Province"), type: "text", half: true, placeholder: L("กรุงเทพมหานคร", "Bangkok") },
          { name: "postcode", label: L("รหัสไปรษณีย์", "Postcode"), type: "text", half: true, placeholder: "10110" },
        ],
      },
    ],
    pipeline: [
      L("ตรวจสอบรูปแบบข้อมูลติดต่อ", "Check contact details"),
      L("ค้นหาข้อมูลซ้ำในระบบ", "Look for duplicates"),
      L("สร้างรหัสลูกค้า", "Create a customer code"),
      L("บันทึกเข้าระบบ CRM", "Save to the CRM"),
    ],
    historyLabel: (data) =>
      readString(data, "customerType") === "person"
        ? L("ลูกค้าบุคคลธรรมดา", "Individual customer")
        : L("ลูกค้านิติบุคคล", "Company customer"),
  },
  document: {
    type: "document",
    title: L("คีย์เอกสาร", "Enter document"),
    verb: L("เอกสาร", "Document"),
    description: L("คีย์ข้อมูลเอกสารบัญชี/จัดซื้อเข้าระบบ", "Key accounting or purchasing documents into the system"),
    icon: FileText,
    refPrefix: "DC",
    defaults: () => ({ docType: "invoice" }),
    steps: [
      {
        id: "header",
        title: L("หัวเอกสาร", "Header"),
        description: L("ประเภท เลขที่ และวันที่", "Type, number and date"),
        fields: [
          { name: "docType", label: L("ประเภทเอกสาร", "Document type"), type: "select", required: true, options: DOC_TYPES },
          { name: "docNo", label: L("เลขที่เอกสาร", "Document no."), type: "text", required: true, half: true, placeholder: "INV-2026-001" },
          { name: "docDate", label: L("วันที่เอกสาร", "Document date"), type: "date", required: true, half: true },
        ],
      },
      {
        id: "detail",
        title: L("รายละเอียด", "Details"),
        description: L("คู่ค้าและจำนวนเงิน", "Partner and amount"),
        fields: [
          { name: "party", label: L("คู่ค้า / ผู้ออกเอกสาร", "Partner / issuer"), type: "text", required: true, placeholder: L("ชื่อบริษัทคู่ค้า", "Partner company name") },
          { name: "amount", label: L("จำนวนเงิน (บาท)", "Amount (THB)"), type: "number", required: true, half: true, placeholder: "0.00" },
          {
            name: "category",
            label: L("หมวดหมู่", "Category"),
            type: "select",
            half: true,
            options: [
              { value: "expense", label: L("ค่าใช้จ่าย", "Expense") },
              { value: "income", label: L("รายได้", "Income") },
              { value: "asset", label: L("สินทรัพย์", "Asset") },
            ],
          },
        ],
      },
      {
        id: "note",
        title: L("หมายเหตุ", "Notes"),
        description: L("ข้อมูลเพิ่มเติมสำหรับผู้ตรวจ", "Extra info for the reviewer"),
        fields: [{ name: "note", label: L("หมายเหตุ", "Notes"), type: "textarea", placeholder: L("เช่น รอเซ็นอนุมัติ", "e.g. awaiting sign-off") }],
      },
    ],
    pipeline: [
      L("อ่านและตรวจสอบหัวเอกสาร", "Read and check the header"),
      L("จับคู่คู่ค้ากับฐานข้อมูล", "Match the partner"),
      L("ลงบัญชีตามหมวดหมู่", "Post to the ledger by category"),
      L("แนบเอกสารเข้าระบบจัดเก็บ", "Attach to document storage"),
    ],
    historyLabel: (data) => {
      const doc = docTypeLabel(readString(data, "docType"));
      const amount = formatBaht(readNumber(data, "amount"));
      return L(`${doc.th} · ${amount}`, `${doc.en} · ${amount}`);
    },
  },
};

export const TASK_LIST: TaskDef[] = [TASKS.quotation, TASKS.customer, TASKS.document];

export const isTaskType = (v: string): v is TaskType => v in TASKS;

/** Thai pipeline labels — the wire format sent to and matched from n8n. */
export const pipelineTh = (type: TaskType): string[] => TASKS[type].pipeline.map((p) => p.th);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(step: StepDef, data: TaskData, lang: Lang = "th"): Record<string, string> {
  const m = (th: string, en: string) => tx({ th, en }, lang);
  const errors: Record<string, string> = {};
  for (const f of step.fields) {
    if (f.type === "items") {
      const items = readItems(data);
      const valid = items.filter((i) => i.name.trim() && i.qty > 0);
      if (f.required && valid.length === 0)
        errors[f.name] = m("เพิ่มอย่างน้อย 1 รายการ พร้อมชื่อและจำนวน", "Add at least 1 item with a name and quantity");
      else if (items.some((i) => !i.name.trim() || i.qty <= 0))
        errors[f.name] = m("กรอกชื่อและจำนวนให้ครบทุกรายการ", "Fill in a name and quantity for every item");
      continue;
    }
    if (f.type === "switch") continue;
    const value = readString(data, f.name).trim();
    if (f.required && !value) {
      errors[f.name] = m("จำเป็นต้องกรอก", "Required");
      continue;
    }
    if (value && f.type === "email" && !EMAIL_RE.test(value)) errors[f.name] = m("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email address");
    if (value && f.type === "number" && (!Number.isFinite(Number(value)) || Number(value) < 0))
      errors[f.name] = m("ต้องเป็นตัวเลขไม่ติดลบ", "Must be a non-negative number");
  }
  return errors;
}
