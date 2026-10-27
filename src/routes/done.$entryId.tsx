import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, CircleSlash, Clock3, ShieldCheck, X } from "lucide-react";

import { MissingTask } from "@/components/app/TaskGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";
import { createTask, useAppState, useHydrated } from "@/lib/session-store";
import { TASKS } from "@/lib/tasks/definitions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/done/$entryId")({
  head: () => ({
    meta: [
      { title: "ภารกิจสำเร็จ — Guided Task Runner" },
      { name: "description", content: "สรุปผลการทำงานของบอทหลังบ้าน" },
      { property: "og:title", content: "ภารกิจสำเร็จ — Guided Task Runner" },
      { property: "og:description", content: "สรุปผลงานที่บอทดำเนินการเสร็จสิ้น" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DonePage,
});

function DonePage() {
  const { entryId } = Route.useParams();
  const hydrated = useHydrated();
  const { history } = useAppState();
  const navigate = useNavigate();
  const { t, tr, locale } = useT();
  const entry = history.find((h) => h.id === entryId);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16">
        <Skeleton className="mx-auto size-20 rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (!entry) return <MissingTask />;

  const def = TASKS[entry.type];
  const ok = entry.status === "success";
  const failed = entry.status === "failed";
  const secs = Math.max(1, Math.round((entry.finishedAt - entry.startedAt) / 1000));

  const again = () => {
    const t = createTask(entry.type);
    void navigate({ to: "/wizard/$taskId", params: { taskId: t.id } });
  };

  return (
    <div className="relative">
      <div className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-72 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto max-w-lg px-4 pb-24 pt-14 text-center sm:pt-20">
        <div
          className={cn(
            "mx-auto flex size-20 animate-in zoom-in-50 items-center justify-center rounded-full duration-500",
            ok
              ? "bg-success text-success-foreground"
              : failed
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary text-muted-foreground",
          )}
        >
          {ok ? (
            <Check className="size-9" strokeWidth={2.5} />
          ) : failed ? (
            <X className="size-9" strokeWidth={2.5} />
          ) : (
            <CircleSlash className="size-8" />
          )}
        </div>
        <p className="eyebrow mt-6">{ok ? "Mission Complete" : failed ? "Failed" : "Cancelled"}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {ok
            ? t(`${def.title.th}สำเร็จ`, `${def.title.en} done`)
            : failed
              ? t(`${def.title.th}ไม่สำเร็จ`, `${def.title.en} failed`)
              : t(`${def.title.th}ถูกยกเลิก`, `${def.title.en} cancelled`)}
        </h1>
        <p className={cn("mt-2 text-sm", failed ? "text-destructive" : "text-muted-foreground")}>
          {ok
            ? t("บอทหลังบ้านดำเนินการครบทุกขั้นตอนแล้ว", "The bot completed every step")
            : failed
              ? `${t("ขัดข้องที่ขั้นตอน", "Failed at step")} ${(entry.failedStep ?? 0) + 1}/${def.pipeline.length}: ${tr(def.pipeline[entry.failedStep ?? 0])}`
              : t("งานถูกหยุดก่อนเสร็จสิ้น ข้อมูลยังอยู่ในงานค้าง", "Stopped before finishing — the task is still in Pending")}
        </p>

        <div className="surface mt-8 animate-rise text-left">
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between px-5 py-3.5">
              <dt className="text-muted-foreground">{t("เลขอ้างอิง", "Reference")}</dt>
              <dd className="font-mono font-medium">{entry.ref}</dd>
            </div>
            <div className="flex justify-between gap-4 px-5 py-3.5">
              <dt className="text-muted-foreground">{t("สรุป", "Summary")}</dt>
              <dd className="text-right font-medium">{tr(entry.label)}</dd>
            </div>
            <div className="flex justify-between px-5 py-3.5">
              <dt className="text-muted-foreground">{t("ขั้นตอนที่ทำ", "Steps run")}</dt>
              <dd className="font-mono">
                {entry.steps}/{def.pipeline.length}
              </dd>
            </div>
            <div className="flex justify-between px-5 py-3.5">
              <dt className="text-muted-foreground">ใช้เวลา</dt>
              <dd className="inline-flex items-center gap-1.5 font-mono">
                <Clock3 className="size-3.5 text-muted-foreground" /> {secs} {t("วินาที", "s")}
              </dd>
            </div>
            <div className="flex justify-between px-5 py-3.5">
              <dt className="text-muted-foreground">{t("เวลาเสร็จ", "Finished")}</dt>
              <dd>{new Date(entry.finishedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</dd>
            </div>
          </dl>
        </div>

        {ok && (
          <p className="mx-auto mt-5 flex max-w-sm items-start justify-center gap-2 text-left text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            {t("ข้อมูลลูกค้าในงานนี้ถูกลบออกจากเบราว์เซอร์แล้ว ประวัติเก็บเพียงสรุปด้านบน", "Customer details for this task were deleted from the browser — history keeps only the summary above")}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link to="/">{t("กลับ Command Center", "Back to Command Center")}</Link>
          </Button>
          <Button size="lg" variant="outline" onClick={again}>
            {t(`${def.title.th}อีกครั้ง`, `${def.title.en} again`)} <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
