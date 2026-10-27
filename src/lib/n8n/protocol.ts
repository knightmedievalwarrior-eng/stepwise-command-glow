import { tt } from "../i18n";

/**
 * Turns whatever n8n sends back into step progress.
 *
 * Accepted shapes (one JSON value per line, concatenated, or a single body):
 *   { "step": 2, "status": "running" | "success" | "error", "message": "..." }
 *   { "status": "success" }                       -> whole run finished
 *   { "status": "error", "step": 3, "message": "..." }
 *   { "status": "success", "steps": [ {step, status, message}, ... ] }
 *   { "message": "..." }                          -> log line only
 *   n8n streaming chunks: { "type": "item", "content": "<json or text>" },
 *                         { "type": "error", "content": "..." }
 * Steps are 1-based in the wire format and 0-based inside the app.
 */

export type RunEvent =
  | { kind: "step"; index: number; status: "running" | "success"; message?: string | undefined }
  | { kind: "error"; index?: number | undefined; message: string }
  | { kind: "done"; message?: string | undefined }
  | { kind: "log"; message: string }
  | { kind: "text"; text: string };

export interface StepProgress {
  total: number;
  /** 0-based index of the step currently being worked on. */
  current: number;
  /** Number of steps completed. */
  completed: number;
  finished: boolean;
  failed?: { index: number; message: string };
}

const SUCCESS = new Set(["success", "succeeded", "ok", "done", "completed", "complete", "finished"]);
const ERROR = new Set(["error", "failed", "fail", "failure", "errored"]);
const RUNNING = new Set(["running", "start", "started", "processing", "in_progress", "pending"]);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

function stepIndex(raw: unknown, labels: string[]): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.round(raw) - 1);
  if (typeof raw === "string") {
    const n = Number(raw);
    if (raw.trim() && Number.isFinite(n)) return Math.max(0, Math.round(n) - 1);
    const i = labels.findIndex((l) => l === raw.trim());
    if (i >= 0) return i;
  }
  return undefined;
}

function messageOf(o: Obj): string | undefined {
  const m = o["message"] ?? o["detail"] ?? o["log"];
  if (typeof m === "string") return m;
  const e = o["error"];
  if (typeof e === "string") return e;
  if (isObj(e) && typeof e["message"] === "string") return e["message"] as string;
  return undefined;
}

/** Normalises one decoded JSON value from n8n into zero or more events. */
export function normalize(value: unknown, labels: string[] = []): RunEvent[] {
  if (Array.isArray(value)) return value.flatMap((v) => normalize(v, labels));
  if (typeof value === "string") return value.trim() ? [{ kind: "log", message: value.trim() }] : [];
  if (!isObj(value)) return [];

  // n8n streaming envelope
  const type = str(value["type"]);
  if (type && ["begin", "item", "end", "error"].includes(type) && ("content" in value || "metadata" in value || type !== "item")) {
    if (type === "error") {
      return [{ kind: "error", message: str(value["content"]) ?? messageOf(value) ?? tt("n8n แจ้งข้อผิดพลาด", "n8n reported an error") }];
    }
    if (type !== "item") return [];
    const content = value["content"];
    if (typeof content === "string") {
      try {
        const parsed = JSON.parse(content) as unknown;
        if (isObj(parsed) || Array.isArray(parsed)) return normalize(parsed, labels);
      } catch {
        /* plain text chunk */
      }
      return content ? [{ kind: "text", text: content }] : [];
    }
    return normalize(content, labels);
  }

  // Some n8n nodes wrap output as { json: {...} }
  if (isObj(value["json"]) && Object.keys(value).length <= 2) return normalize(value["json"], labels);

  const events: RunEvent[] = [];
  const steps = value["steps"];
  if (Array.isArray(steps)) events.push(...steps.flatMap((s) => normalize(s, labels)));

  const rawStatus = (str(value["status"]) ?? "").toLowerCase();
  const failedFlag = value["ok"] === false || value["success"] === false;
  const index = stepIndex(value["step"] ?? value["stepIndex"] ?? value["failedStep"], labels);
  const message = messageOf(value);
  const hasStep = index !== undefined;

  if (ERROR.has(rawStatus) || failedFlag || (!rawStatus && typeof value["error"] === "string")) {
    events.push({ kind: "error", index, message: message ?? tt("n8n แจ้งว่าขั้นตอนนี้ล้มเหลว", "n8n reported this step failed") });
  } else if (hasStep && SUCCESS.has(rawStatus)) {
    events.push({ kind: "step", index, status: "success", message });
  } else if (hasStep && (RUNNING.has(rawStatus) || !rawStatus)) {
    events.push({ kind: "step", index, status: "running", message });
  } else if (SUCCESS.has(rawStatus)) {
    events.push({ kind: "done", message });
  } else if (message) {
    events.push({ kind: "log", message });
  }
  return events;
}

export function initialProgress(total: number): StepProgress {
  return { total, current: 0, completed: 0, finished: false };
}

export function applyEvent(s: StepProgress, ev: RunEvent): StepProgress {
  if (s.finished) return s;
  const last = Math.max(0, s.total - 1);
  switch (ev.kind) {
    case "step": {
      const i = Math.min(ev.index, last);
      if (ev.status === "running") return { ...s, current: i, completed: Math.max(s.completed, i) };
      const completed = Math.max(s.completed, i + 1);
      return { ...s, completed, current: Math.min(completed, last) };
    }
    case "error": {
      const i = Math.min(ev.index ?? s.current, last);
      return { ...s, current: i, completed: Math.min(s.completed, i), finished: true, failed: { index: i, message: ev.message } };
    }
    case "done":
      return { ...s, current: last, completed: s.total, finished: true };
    default:
      return s;
  }
}

export function percent(s: StepProgress): number {
  return s.total ? Math.round((s.completed / s.total) * 100) : 0;
}

/** "กำลังดำเนินการ (2/5)…" */
export function statusLabel(s: StepProgress, lang: "th" | "en" = "th"): string {
  const en = lang === "en";
  if (s.failed) return en ? `Failed at step ${s.failed.index + 1}/${s.total}` : `ขัดข้องที่ขั้นตอน ${s.failed.index + 1}/${s.total}`;
  if (s.finished) return en ? `Completed (${s.total}/${s.total})` : `เสร็จสมบูรณ์ (${s.total}/${s.total})`;
  const n = `${Math.min(s.current + 1, s.total)}/${s.total}`;
  return en ? `In progress (${n})…` : `กำลังดำเนินการ (${n})…`;
}

/**
 * Incremental splitter: feeds raw text and yields each complete top-level
 * JSON value. Handles NDJSON, SSE "data:" lines, concatenated objects and a
 * single (pretty-printed) body. Text outside JSON values is ignored.
 */
export function createJsonSplitter() {
  let buf = "";
  let text = "";
  return {
    push(chunk: string): unknown[] {
      buf += chunk;
      const out: unknown[] = [];
      let depth = 0;
      let start = -1;
      let inStr = false;
      let esc = false;
      let consumed = 0;
      for (let i = 0; i < buf.length; i++) {
        const c = buf[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === "\\") esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"' && depth > 0) inStr = true;
        else if (c === "{" || c === "[") {
          if (depth === 0) start = i;
          depth++;
        } else if ((c === "}" || c === "]") && depth > 0) {
          depth--;
          if (depth === 0 && start >= 0) {
            const text = buf.slice(start, i + 1);
            try {
              out.push(JSON.parse(text));
            } catch {
              /* not JSON — skip */
            }
            consumed = i + 1;
            start = -1;
          }
        } else if (depth === 0) {
          text += c;
          consumed = i + 1;
        }
      }
      buf = buf.slice(start >= 0 ? start : consumed);
      return out;
    },
    /** Leftover non-JSON text (e.g. a plain-text response). */
    rest(): string {
      const r = (text + buf)
        .split("\n")
        .filter((l) => !/^\s*(data|event|id|retry):/.test(l))
        .join("\n")
        .trim();
      buf = "";
      text = "";
      return r;
    },
  };
}
