/**
 * Builds the Thai-language JSON payload sent to the n8n webhook.
 */
import {
  TASKS,
  calcQuotation,
  docTypeLabel,
  formatBaht,
  readBool,
  readItems,
  readNumber,
  readString,
  type FieldDef,
  type QuoteTotals,
  type TaskData,
  type TaskType,
} from "../tasks/definitions";
import { tx } from "../i18n";

export interface PayloadField {
  key: string;
  label: string;
  step: string;
  value: unknown;
  display: string;
}

export interface TaskPayload {
  event: "task.run";
  version: 1;
  source: "guided-task-runner";
  runId: string;
  taskId: string;
  taskType: TaskType;
  title: string;
  /** One-line Thai command, e.g. "ออกใบเสนอราคาให้ บริษัท สยามเทค จำกัด". */
  command: string;
  /** Multi-line Thai summary: "ป้ายชื่อ: ค่า" per field. */
  summary: string;
  locale: "th-TH";
  sentAt: string;
  steps: { step: number; label: string }[];
  fields: PayloadField[];
  data: TaskData;
  totals?: QuoteTotals;
}

function fieldDisplay(f: FieldDef, data: TaskData): string {
  if (f.type === "switch") return readBool(data, f.name) ? "ใช่" : "ไม่ใช่";
  if (f.type === "items") {
    return readItems(data)
      .map((it) => `${it.name} × ${it.qty} @ ${formatBaht(it.price)}`)
      .join(", ");
  }
  const raw = readString(data, f.name).trim();
  if (!raw) return "";
  if (f.type === "select") return tx(f.options?.find((o) => o.value === raw)?.label ?? raw, "th");
  if (f.name === "amount") return formatBaht(readNumber(data, f.name));
  return raw;
}

export function buildCommand(type: TaskType, data: TaskData): string {
  const def = TASKS[type];
  if (type === "quotation") {
    const who = readString(data, "customerName").trim();
    const items = readItems(data);
    const t = calcQuotation(items, readNumber(data, "discount"), readBool(data, "vat"));
    return `${def.title.th}${who ? `ให้ ${who}` : ""} · ${items.length} รายการ · ยอดสุทธิ ${formatBaht(t.total)}`;
  }
  if (type === "customer") {
    const name = readString(data, "name").trim();
    return `${def.title.th}${name ? ` ${name}` : ""}`;
  }
  const docNo = readString(data, "docNo").trim();
  return `${def.title.th} ${docTypeLabel(readString(data, "docType")).th}${docNo ? ` เลขที่ ${docNo}` : ""} · ${formatBaht(readNumber(data, "amount"))}`;
}

export function buildPayload(
  task: { id: string; type: TaskType; data: TaskData },
  runId: string,
  now = new Date(),
): TaskPayload {
  const def = TASKS[task.type];
  const fields: PayloadField[] = def.steps.flatMap((s) =>
    s.fields.map((f) => ({
      key: f.name,
      label: f.label.th,
      step: s.title.th,
      value: task.data[f.name] ?? null,
      display: fieldDisplay(f, task.data),
    })),
  );
  const summary = fields
    .filter((f) => f.display)
    .map((f) => `${f.label}: ${f.display}`)
    .join("\n");
  const payload: TaskPayload = {
    event: "task.run",
    version: 1,
    source: "guided-task-runner",
    runId,
    taskId: task.id,
    taskType: task.type,
    title: def.title.th,
    command: buildCommand(task.type, task.data),
    summary,
    locale: "th-TH",
    sentAt: now.toISOString(),
    steps: def.pipeline.map((label, i) => ({ step: i + 1, label: label.th })),
    fields,
    data: task.data,
  };
  if (task.type === "quotation") {
    payload.totals = calcQuotation(readItems(task.data), readNumber(task.data, "discount"), readBool(task.data, "vat"));
  }
  return payload;
}

/** Sample used in the settings screen so users can design their n8n workflow. */
export function samplePayload(): TaskPayload {
  return buildPayload(
    {
      id: "task_example",
      type: "quotation",
      data: {
        customerName: "บริษัท สยามเทค จำกัด",
        contactName: "คุณสมชาย",
        email: "somchai@siamtech.co.th",
        items: [{ name: "บริการติดตั้งระบบ", qty: 2, price: 500 }],
        discount: 10,
        vat: true,
        validDays: 30,
      },
    },
    "run_example",
    new Date("2026-01-01T09:00:00.000Z"),
  );
}
