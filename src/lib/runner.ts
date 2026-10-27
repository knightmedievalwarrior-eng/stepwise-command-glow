/**
 * Execution engine for the bot pipeline.
 *
 * Two engines share the same callbacks:
 *  - "n8n": POSTs the Thai payload straight from the browser to the user's
 *    n8n webhook and reads step events from the (optionally streamed) reply.
 *  - "simulate": local demo used while no webhook is configured.
 */
import { tt, tx } from "./i18n";
import { buildPayload } from "./n8n/payload";
import type { N8nConfig } from "./n8n/config";
import {
  applyEvent,
  createJsonSplitter,
  initialProgress,
  normalize,
  type RunEvent,
  type StepProgress,
} from "./n8n/protocol";
import {
  TASKS,
  calcQuotation,
  pipelineTh,
  docTypeLabel,
  formatBaht,
  readBool,
  readItems,
  readNumber,
  readString,
  type TaskData,
  type TaskType,
} from "./tasks/definitions";

export type LogLevel = "info" | "success" | "warn" | "error" | "system";

export interface LogLine {
  id: number;
  at: number;
  level: LogLevel;
  message: string;
}

export interface RunHandlers {
  onLog: (line: LogLine) => void;
  onProgress: (p: StepProgress) => void;
  onDone: () => void;
  onError: (failure: { index: number; message: string }) => void;
}

export interface RunControl {
  canPause: boolean;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export interface RunTask {
  id: string;
  type: TaskType;
  data: TaskData;
}

export type RunMode = "n8n" | "simulate";

export interface RunOptions {
  mode: RunMode;
  config?: N8nConfig;
  runId: string;
  speed?: number;
}

function makeLogger(h: RunHandlers) {
  let seq = 0;
  return (level: LogLevel, message: string) => h.onLog({ id: ++seq, at: Date.now(), level, message });
}

/* ------------------------------------------------------------------ */
/* n8n engine                                                          */
/* ------------------------------------------------------------------ */

function startN8n(task: RunTask, h: RunHandlers, config: N8nConfig, runId: string): RunControl {
  const wire = pipelineTh(task.type);
  const labels = TASKS[task.type].pipeline.map((p) => tx(p));
  const total = labels.length;
  const log = makeLogger(h);
  const abort = new AbortController();
  let progress = initialProgress(total);
  let cancelled = false;
  let textBuf = "";

  const flushText = (force = false) => {
    const parts = textBuf.split("\n");
    textBuf = force ? "" : (parts.pop() ?? "");
    for (const p of parts) if (p.trim()) log("info", `  ↳ ${p.trim()}`);
  };

  const apply = (ev: RunEvent) => {
    if (cancelled || progress.finished) return;
    if (ev.kind === "text") {
      textBuf += ev.text;
      flushText();
      return;
    }
    if (ev.kind === "log") {
      log("info", `  ↳ ${ev.message}`);
      return;
    }
    const before = progress;
    progress = applyEvent(progress, ev);
    if (ev.kind === "step") {
      const label = labels[Math.min(ev.index, total - 1)];
      if (ev.status === "running") log("info", `[${ev.index + 1}/${total}] ${label}…`);
      if (ev.message) log("info", `  ↳ ${ev.message}`);
      if (ev.status === "success") log("success", `✓ ${label}`);
    }
    if (ev.kind === "error" && progress.failed) {
      const i = progress.failed.index;
      log("error", `✗ ${tt("ขั้นตอน", "Step")} ${i + 1}/${total} ${labels[i]} — ${ev.message}`);
    }
    if (ev.kind === "done" && ev.message) log("info", `  ↳ ${ev.message}`);
    if (before !== progress) h.onProgress(progress);
  };

  const fail = (message: string) => {
    apply({ kind: "error", message });
    if (progress.failed) h.onError(progress.failed);
  };

  void (async () => {
    log("system", tt(`ส่งคำสั่งไป n8n · ${safeHost(config.url)} · ${total} ขั้นตอน`, `Sending to n8n · ${safeHost(config.url)} · ${total} steps`));
    h.onProgress(progress);
    log("info", `[1/${total}] ${labels[0]}…`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson, application/json, text/plain",
    };
    if (config.authHeader && config.authValue) headers[config.authHeader] = config.authValue;

    let res: Response;
    try {
      res = await fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildPayload(task, runId)),
        signal: abort.signal,
      });
    } catch {
      if (cancelled) return;
      return fail(
        tt(
          "เชื่อมต่อ n8n ไม่ได้ — ตรวจสอบ URL, เปิดใช้งาน workflow และตั้ง Allowed Origins (CORS) ใน Webhook node",
          "Can't reach n8n — check the URL, activate the workflow and set Allowed Origins (CORS) on the Webhook node",
        ),
      );
    }
    if (cancelled) return;
    log("system", tt(`n8n ตอบกลับ HTTP ${res.status}`, `n8n replied HTTP ${res.status}`));

    const splitter = createJsonSplitter();
    const handleChunk = (chunk: string) => {
      for (const value of splitter.push(chunk)) normalize(value, wire).forEach(apply);
    };

    try {
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (cancelled) return;
          if (done) break;
          handleChunk(decoder.decode(value, { stream: true }));
        }
        handleChunk(decoder.decode());
      } else {
        handleChunk(await res.text());
      }
    } catch {
      if (cancelled) return;
      return fail(tt("การเชื่อมต่อกับ n8n ขาดระหว่างทำงาน", "Lost the connection to n8n mid-run"));
    }
    flushText(true);
    const rest = splitter.rest();

    if (progress.failed) return h.onError(progress.failed);

    if (!res.ok) {
      const detail = rest ? ` · ${rest.slice(0, 200)}` : "";
      const reason =
        res.status === 401 || res.status === 403
          ? tt("n8n ปฏิเสธสิทธิ์ (ตรวจสอบ Header Auth)", "n8n denied access (check Header Auth)")
          : res.status === 404
            ? tt("ไม่พบ Webhook (workflow ยังไม่ได้ Publish หรือ URL ผิด)", "Webhook not found (workflow not published or wrong URL)")
            : tt(`n8n ตอบกลับข้อผิดพลาด HTTP ${res.status}`, `n8n returned error HTTP ${res.status}`);
      return fail(reason + detail);
    }

    if (rest) log("info", `  ↳ ${rest.slice(0, 300)}`);
    if (!progress.finished) {
      if (progress.completed === 0) {
        log("warn", tt("n8n ไม่ได้ส่งสถานะรายขั้นตอน — ถือว่าสำเร็จเมื่อรับคำสั่งแล้ว", "n8n sent no step updates — treating the accepted job as done"));
      }
      for (let i = progress.completed; i < total; i++) apply({ kind: "step", index: i, status: "success" });
      apply({ kind: "done" });
    }
    log("system", tt("ภารกิจเสร็จสมบูรณ์ · ลบข้อมูลชั่วคราวออกจากเบราว์เซอร์", "Mission complete · temporary data removed from this browser"));
    h.onDone();
  })();

  return {
    canPause: false,
    pause: () => {},
    resume: () => {},
    cancel: () => {
      cancelled = true;
      abort.abort();
    },
  };
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Simulation engine (no webhook configured)                           */
/* ------------------------------------------------------------------ */

function detailsFor(type: TaskType, step: number, data: TaskData): string[] {
  if (type === "quotation") {
    const items = readItems(data);
    const t = calcQuotation(items, readNumber(data, "discount"), readBool(data, "vat"));
    return [
      [tt(`พบ ${items.length} รายการ ข้อมูลครบถ้วน`, `${items.length} item(s) found, details complete`)],
      [
        tt(`ยอดก่อนส่วนลด ${formatBaht(t.subtotal)}`, `Subtotal ${formatBaht(t.subtotal)}`),
        tt(`VAT ${formatBaht(t.vat)} · ยอดสุทธิ ${formatBaht(t.total)}`, `VAT ${formatBaht(t.vat)} · Total ${formatBaht(t.total)}`),
      ],
      [tt("จองเลขที่เอกสารสำเร็จ", "Document number reserved")],
      [
        tt(`ยืนราคา ${readNumber(data, "validDays") || 30} วัน`, `Valid for ${readNumber(data, "validDays") || 30} days`),
        tt("เรนเดอร์เทมเพลตเสร็จสิ้น", "Template rendered"),
      ],
      [tt("ส่งเข้าระบบสำเร็จ (จำลอง)", "Submitted (simulated)")],
    ][step] ?? [];
  }
  if (type === "customer") {
    return [
      [
        readString(data, "email")
          ? tt("เบอร์โทรและอีเมลถูกต้อง", "Phone and email look good")
          : tt("เบอร์โทรถูกต้อง · ไม่มีอีเมล", "Phone looks good · no email"),
      ],
      [tt("ไม่พบข้อมูลซ้ำ", "No duplicates found")],
      [tt("สร้างรหัสลูกค้าใหม่", "New customer code created")],
      [tt("บันทึกสำเร็จ (จำลอง)", "Saved (simulated)")],
    ][step] ?? [];
  }
  return [
    [tt(`${tx(docTypeLabel(readString(data, "docType")), "th")} เลขที่ถูกต้อง`, `${tx(docTypeLabel(readString(data, "docType")), "en")} number is valid`)],
    [tt("จับคู่คู่ค้าสำเร็จ", "Partner matched")],
    [tt(`ลงบัญชี ${formatBaht(readNumber(data, "amount"))}`, `Posted ${formatBaht(readNumber(data, "amount"))}`)],
    [tt("จัดเก็บสำเร็จ (จำลอง)", "Stored (simulated)")],
  ][step] ?? [];
}

function startSimulation(task: RunTask, h: RunHandlers, speed: number): RunControl {
  const pipeline = TASKS[task.type].pipeline.map((p) => tx(p));
  const total = pipeline.length;
  const log = makeLogger(h);
  let progress = initialProgress(total);
  let paused = false;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const step = (ev: RunEvent) => {
    progress = applyEvent(progress, ev);
    h.onProgress(progress);
  };

  type Ev = { delay: number; run: () => void };
  const events: Ev[] = [];
  events.push({ delay: 200, run: () => log("system", tt(`โหมดจำลอง (ยังไม่ได้ตั้งค่า n8n) · ${total} ขั้นตอน`, `Demo mode (n8n not set up) · ${total} steps`)) });
  pipeline.forEach((label, i) => {
    events.push({
      delay: 350,
      run: () => {
        step({ kind: "step", index: i, status: "running" });
        log("info", `[${i + 1}/${total}] ${label}…`);
      },
    });
    for (const d of detailsFor(task.type, i, task.data)) {
      events.push({ delay: 550 + Math.random() * 450, run: () => log("info", `  ↳ ${d}`) });
    }
    events.push({
      delay: 400,
      run: () => {
        log("success", `✓ ${label}`);
        step({ kind: "step", index: i, status: "success" });
      },
    });
  });
  events.push({
    delay: 300,
    run: () => {
      step({ kind: "done" });
      log("system", tt("ภารกิจเสร็จสมบูรณ์ · ลบข้อมูลชั่วคราวออกจากเบราว์เซอร์", "Mission complete · temporary data removed from this browser"));
      h.onDone();
    },
  });

  let cursor = 0;
  const tick = () => {
    if (cancelled || paused) return;
    const ev = events[cursor];
    if (!ev) return;
    timer = setTimeout(() => {
      if (cancelled || paused) return;
      ev.run();
      cursor += 1;
      tick();
    }, ev.delay / speed);
  };
  h.onProgress(progress);
  tick();

  return {
    canPause: true,
    pause: () => {
      if (paused || cancelled) return;
      paused = true;
      if (timer) clearTimeout(timer);
      log("warn", tt("หยุดชั่วคราวโดยผู้ใช้", "Paused by user"));
    },
    resume: () => {
      if (!paused || cancelled) return;
      paused = false;
      log("system", tt("ทำงานต่อ", "Resumed"));
      tick();
    },
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

export function startRun(task: RunTask, h: RunHandlers, opts: RunOptions): RunControl {
  if (opts.mode === "n8n" && opts.config?.url) return startN8n(task, h, opts.config, opts.runId);
  return startSimulation(task, h, opts.speed ?? 1);
}
