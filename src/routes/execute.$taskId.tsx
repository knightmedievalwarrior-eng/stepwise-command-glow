import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, Loader2, Pause, Pencil, Play, RotateCcw, Square, Terminal, Webhook, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { N8nSettingsDialog } from "@/components/app/N8nSettingsDialog";
import { MissingTask } from "@/components/app/TaskGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";
import { percent, statusLabel } from "@/lib/n8n/protocol";
import {
  cancelRun,
  dismissRun,
  launchRun,
  pauseRun,
  resumeRun,
  useRun,
  type LiveRun,
} from "@/lib/run-store";
import { updateTask, useHydrated, useTask, type Task } from "@/lib/session-store";
import { TASKS } from "@/lib/tasks/definitions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/execute/$taskId")({
  head: () => ({
    meta: [
      { title: "Real-Time Execution — บอทกำลังทำงาน" },
      { name: "description", content: "ติดตามสถานะบอท n8n แบบเรียลไทม์ พร้อม Progress และ Log ทีละขั้น" },
      { property: "og:title", content: "Real-Time Execution — บอทกำลังทำงาน" },
      { property: "og:description", content: "Progress bar และ Log การทำงานทีละขั้นจาก n8n" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutePage,
});

function ExecutePage() {
  const { taskId } = Route.useParams();
  const hydrated = useHydrated();
  const task = useTask(taskId);
  const run = useRun(taskId);

  if (!hydrated) return <LoadingView />;
  if (run) return <Execution run={run} />;
  if (!task) return <MissingTask />;
  // A previous run failed or was interrupted (e.g. page reload): never resend
  // automatically — let the user check the data and confirm again.
  if (task.status !== "ready" || task.lastRun) {
    return <Navigate to="/review/$taskId" params={{ taskId }} replace />;
  }
  return <Launcher task={task} />;
}

function LoadingView() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-10 sm:px-6">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}

function Launcher({ task }: { task: Task }) {
  useEffect(() => {
    launchRun(task);
  }, [task]);
  return <LoadingView />;
}

function Execution({ run }: { run: LiveRun }) {
  const navigate = useNavigate();
  const def = TASKS[run.type];
  const { t, tr, lang } = useT();
  const pipeline = def.pipeline.map(tr);
  const total = pipeline.length;
  const logBox = useRef<HTMLDivElement>(null);
  const { progress, phase } = run;
  const pct = percent(progress);
  const failedIndex = run.failure?.index;

  useEffect(() => {
    if (phase !== "done" || !run.entryId) return;
    const entryId = run.entryId;
    const t = setTimeout(() => {
      dismissRun(run.taskId);
      void navigate({ to: "/done/$entryId", params: { entryId } });
    }, 1400);
    return () => clearTimeout(t);
  }, [phase, run.entryId, run.taskId, navigate]);

  useEffect(() => {
    const el = logBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run.logs.length]);

  const cancel = () => {
    cancelRun(run.taskId);
    void navigate({ to: "/review/$taskId", params: { taskId: run.taskId } });
  };

  const retry = () => {
    // Clear the failure first so the next render mounts the Launcher (fresh run)
    // instead of redirecting to review.
    updateTask(run.taskId, { lastRun: undefined });
    dismissRun(run.taskId);
  };

  const editData = () => {
    dismissRun(run.taskId);
    void navigate({ to: "/review/$taskId", params: { taskId: run.taskId } });
  };

  const active = phase === "running" || phase === "paused";
  const currentLabel = pipeline[progress.current] ?? "";
  const failedLabel = run.failure ? (pipeline[run.failure.index] ?? "") : "";
  const headline =
    phase === "paused" ? `${t("หยุดชั่วคราว", "Paused")} (${progress.current + 1}/${total})` : statusLabel(progress, lang);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                phase === "running" && "animate-pulse-dot bg-signal",
                phase === "paused" && "bg-warning",
                phase === "done" && "bg-success",
                phase === "error" && "bg-destructive",
              )}
            />
            Real-Time Execution · {run.mode === "n8n" ? "n8n" : t("โหมดจำลอง", "demo mode")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {phase === "error"
              ? t(`${def.title.th}ไม่สำเร็จ`, `${def.title.en} failed`)
              : t(`บอทกำลัง${def.title.th}`, `Bot is working: ${def.title.en}`)}
          </h1>
        </div>
        {active && (
          <div className="flex gap-2">
            {run.canPause && (
              <Button variant="outline" onClick={() => (phase === "paused" ? resumeRun(run.taskId) : pauseRun(run.taskId))}>
                {phase === "paused" ? (
                  <>
                    <Play /> {t("ทำต่อ", "Resume")}
                  </>
                ) : (
                  <>
                    <Pause /> {t("หยุดชั่วคราว", "Pause")}
                  </>
                )}
              </Button>
            )}
            <Button variant="ghost" onClick={cancel}>
              <Square /> {t("ยกเลิก", "Cancel")}
            </Button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {phase === "error" && run.failure && (
        <div
          role="alert"
          className="mt-6 animate-in fade-in slide-in-from-top-1 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <AlertTriangle className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-destructive">
                {t("ขัดข้องที่ขั้นตอน", "Failed at step")} {run.failure.index + 1}/{total}: {failedLabel}
              </p>
              <p className="mt-1 break-words text-sm text-foreground/80">{run.failure.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t("ข้อมูลงานยังอยู่ในงานค้าง แก้ไขหรือส่งใหม่ได้", "The task is still in Pending — you can edit or resend it")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="destructive" onClick={retry}>
                  <RotateCcw /> {t("ลองส่งใหม่", "Try again")}
                </Button>
                <Button size="sm" variant="outline" onClick={editData}>
                  <Pencil /> {t("ตรวจทาน / แก้ไขข้อมูล", "Review / edit details")}
                </Button>
                <N8nSettingsDialog
                  trigger={
                    <Button size="sm" variant="ghost">
                      <Webhook /> {t("ตั้งค่า n8n", "n8n settings")}
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="surface mt-6 p-5 sm:p-7">
        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0" aria-live="polite">
            <p className={cn("text-base font-semibold", phase === "error" && "text-destructive")}>{headline}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {phase === "done" ? t("ทุกขั้นตอนเสร็จแล้ว", "All steps done") : phase === "error" ? failedLabel : currentLabel}
            </p>
          </div>
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
            {pct}
            <span className="text-xl text-muted-foreground">%</span>
          </p>
        </div>
        <div
          className="mt-4 flex h-3 gap-1"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={headline}
        >
          {pipeline.map((label, i) => {
            const done = i < progress.completed;
            const failed = i === failedIndex;
            const current = !done && !failed && i === progress.current && active;
            return (
              <div key={label} className="relative flex-1 overflow-hidden rounded-full bg-secondary" title={label}>
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
                    done && (phase === "done" ? "bg-success" : "bg-signal"),
                    failed && "bg-destructive",
                    current && "progress-stripes bg-signal/70",
                    current && phase === "running" && "animate-stripes",
                  )}
                  style={{ width: done || failed ? "100%" : current ? "45%" : "0%" }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-muted-foreground">
          <span>
            {progress.completed}/{total} {t("ขั้นตอนเสร็จ", "steps done")}
          </span>
          <span>{run.mode === "n8n" ? `→ ${run.target}` : t("ยังไม่ได้เชื่อม n8n", "n8n not connected")}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Step checklist */}
        <ol className="surface space-y-1 p-3">
          {pipeline.map((label, i) => {
            const done = i < progress.completed;
            const failed = i === failedIndex;
            const current = !done && !failed && i === progress.current && active;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  current && "bg-signal-soft",
                  failed && "bg-destructive/10",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[0.7rem]",
                    done && "border-success bg-success text-success-foreground",
                    failed && "border-destructive bg-destructive text-destructive-foreground",
                    current && "border-signal text-signal",
                    !done && !current && !failed && "border-border text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" />
                  ) : failed ? (
                    <X className="size-3.5" />
                  ) : current && phase === "running" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    !done && !current && !failed && "text-muted-foreground",
                    current && "font-medium",
                    failed && "font-medium text-destructive",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Log */}
        <div className="surface flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Terminal className="size-3.5" /> execution.log
            </span>
            <span className="font-mono text-[0.65rem] text-muted-foreground">{run.logs.length} lines</span>
          </div>
          <div
            ref={logBox}
            className="h-[340px] overflow-y-auto bg-log px-4 py-3 font-mono text-[0.78rem] leading-6 text-log-foreground"
            aria-live="polite"
          >
            {run.logs.map((l) => (
              <div key={l.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <span className="shrink-0 text-muted-foreground">
                  {new Date(l.at).toLocaleTimeString(lang === "en" ? "en-GB" : "th-TH", { hour12: false })}
                </span>
                <span
                  className={cn(
                    "min-w-0 whitespace-pre-wrap break-words",
                    l.level === "success" && "text-success",
                    l.level === "warn" && "text-warning",
                    l.level === "error" && "font-medium text-destructive",
                    l.level === "system" && "text-signal",
                  )}
                >
                  {l.message}
                </span>
              </div>
            ))}
            {phase === "running" && <span className="inline-block h-4 w-2 animate-pulse bg-foreground/60 align-middle" />}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-[0.7rem] text-muted-foreground">
            <span className="truncate">
              {run.mode === "n8n"
                ? t(`ส่งตรงจากเบราว์เซอร์ไป n8n · ${run.target}`, `Sent straight from this browser to n8n · ${run.target}`)
                : t("โหมดจำลอง · ตั้งค่า Webhook เพื่อส่งงานไป n8n จริง", "Demo mode · set up a webhook to send tasks to n8n")}
            </span>
            {phase !== "error" && (
              <N8nSettingsDialog
                trigger={
                  <button type="button" className="shrink-0 underline-offset-2 hover:text-foreground hover:underline">
                    {t("ตั้งค่า n8n", "n8n settings")}
                  </button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {phase === "error" && (
        <div className="mt-6 text-center">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">{t("กลับ Command Center", "Back to Command Center")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
