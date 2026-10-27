import type { TaskData, TaskType } from "./tasks/definitions";

/**
 * Hybrid command parser: commands open the matching task right away;
 * anything that reads like a question goes to the AI assistant.
 */
export type Intent =
  | { kind: "task"; type: TaskType; prefill: TaskData }
  | { kind: "question" };

const KEYWORDS: Record<TaskType, string[]> = {
  quotation: ["ใบเสนอราคา", "เสนอราคา", "quotation", "quote"],
  customer: ["ข้อมูลลูกค้า", "ลูกค้าใหม่", "เพิ่มลูกค้า", "บันทึกลูกค้า", "ลงลูกค้า", "customer"],
  document: ["คีย์เอกสาร", "ลงเอกสาร", "บันทึกเอกสาร", "ใบแจ้งหนี้", "ใบเสร็จ", "ใบกำกับ", "ใบสั่งซื้อ", "document", "invoice", "receipt"],
};

const QUESTION_MARKERS = [
  "?",
  "？",
  "อะไร",
  "ยังไง",
  "อย่างไร",
  "ทำไม",
  "ไหม",
  "มั้ย",
  "หรือเปล่า",
  "เท่าไร",
  "เท่าไหร่",
  "แบบไหน",
  "ได้ไหม",
  "ช่วยอธิบาย",
  "อธิบาย",
  "แนะนำ",
  "what",
  "how",
  "why",
  "which",
  "explain",
];

const DOC_TYPE_HINTS: [string, string][] = [
  ["ใบกำกับ", "tax-invoice"],
  ["ใบแจ้งหนี้", "invoice"],
  ["invoice", "invoice"],
  ["ใบเสร็จ", "receipt"],
  ["receipt", "receipt"],
  ["ใบสั่งซื้อ", "po"],
];

export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return QUESTION_MARKERS.some((m) => t.includes(m));
}

function findType(t: string): { type: TaskType; keyword: string; index: number } | null {
  let best: { type: TaskType; keyword: string; index: number } | null = null;
  for (const [type, words] of Object.entries(KEYWORDS) as [TaskType, string[]][]) {
    for (const w of words) {
      const i = t.indexOf(w);
      if (i >= 0 && (!best || i < best.index)) best = { type, keyword: w, index: i };
    }
  }
  return best;
}

/** Name after "ให้ / สำหรับ / ชื่อ / for", e.g. "ออกใบเสนอราคาให้ บริษัท สยามเทค". */
function extractName(original: string): string | undefined {
  const m = original.match(/(?:ให้กับ|ให้|สำหรับ|ชื่อ|\bfor\b)\s*(.+)$/i);
  const name = m?.[1]?.trim().replace(/^(?:ลูกค้า|คุณ)\s*/, "");
  return name ? name : undefined;
}

export function parseCommand(input: string): Intent {
  const original = input.trim();
  if (!original) return { kind: "question" };
  if (isQuestion(original)) return { kind: "question" };

  const lower = original.toLowerCase();
  const hit = findType(lower);
  if (!hit) return { kind: "question" };

  const prefill: TaskData = {};
  const name = extractName(original);
  if (hit.type === "quotation" && name) prefill["customerName"] = name;
  if (hit.type === "customer" && name) prefill["name"] = name;
  if (hit.type === "document") {
    const doc = DOC_TYPE_HINTS.find(([k]) => lower.includes(k));
    if (doc) prefill["docType"] = doc[1];
    if (name) prefill["party"] = name;
  }
  return { kind: "task", type: hit.type, prefill };
}
