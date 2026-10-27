import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCheck, CloudOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { FieldInput } from "@/components/app/FieldInput";
import { StepDots, StepRail } from "@/components/app/StepRail";
import { TaskGate } from "@/components/app/TaskGate";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { updateTask, type Task } from "@/lib/session-store";
import { TASKS, validateStep } from "@/lib/tasks/definitions";

export const Route = createFileRoute("/wizard/$taskId")({
  head: () => ({
    meta: [
      { title: "Wizard Task Runner — กรอกข้อมูลทีละขั้น" },
      { name: "description", content: "กรอกข้อมูลงานทีละขั้นตอน พร้อมบันทึกอัตโนมัติในเบราว์เซอร์" },
      { property: "og:title", content: "Wizard Task Runner — กรอกข้อมูลทีละขั้น" },
      { property: "og:description", content: "ฟอร์มทีละขั้นตอน ย้อนกลับ/ถัดไป และบันทึกอัตโนมัติ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WizardPage,
});

function WizardPage() {
  const { taskId } = Route.useParams();
  return <TaskGate taskId={taskId}>{(task) => <Wizard task={task} />}</TaskGate>;
}

function useAutosaveIndicator() {
  const [state, setState] = useState<{ saving: boolean; at: number | null }>({ saving: false, at: null });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const ping = () => {
    setState((s) => ({ ...s, saving: true }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState({ saving: false, at: Date.now() }), 450);
  };
  return { ...state, ping };
}

function Wizard({ task }: { task: Task }) {
  const navigate = useNavigate();
  const def = TASKS[task.type];
  const { t, tr, lang, locale } = useT();
  const total = def.steps.length;
  const index = Math.min(task.stepIndex, total - 1);
  const step = def.steps[index]!;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reachable, setReachable] = useState(index);
  const autosave = useAutosaveIndicator();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setReachable((r) => Math.max(r, index));
    setErrors({});
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  const onChange = (name: string, value: unknown) => {
    updateTask(task.id, { data: { [name]: value }, status: "draft" });
    autosave.ping();
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  };

  const goTo = (i: number) => {
    updateTask(task.id, { stepIndex: i });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    const errs = validateStep(step, task.data, lang);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    if (index < total - 1) {
      goTo(index + 1);
      return;
    }
    // Final step: validate everything, then move to review.
    for (let i = 0; i < total; i++) {
      const stepErrs = validateStep(def.steps[i]!, task.data, lang);
      if (Object.keys(stepErrs).length) {
        goTo(i);
        setTimeout(() => setErrors(stepErrs), 0);
        return;
      }
    }
    updateTask(task.id, { status: "ready" });
    void navigate({ to: "/review/$taskId", params: { taskId: task.id } });
  };

  const savedLabel = autosave.saving
    ? t("กำลังบันทึก…", "Saving…")
    : autosave.at
      ? `${t("บันทึกอัตโนมัติ", "Autosaved")} ${new Date(autosave.at).toLocaleTimeString(locale)}`
      : t("บันทึกอัตโนมัติเปิดอยู่", "Autosave is on");

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft /> Command Center
          </Link>
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {autosave.saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCheck className="size-3.5 text-success" />
          )}
          {savedLabel}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
          <def.icon className="size-5" />
        </span>
        <div>
          <p className="eyebrow">Wizard Task Runner</p>
          <h1 className="text-2xl font-semibold tracking-tight">{tr(def.title)}</h1>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block">
          <StepRail steps={def.steps} current={index} reachable={reachable} onSelect={goTo} />
          <p className="mt-6 flex items-start gap-2 px-3 text-xs leading-relaxed text-muted-foreground">
            <CloudOff className="mt-0.5 size-3.5 shrink-0" />
            {t("ข้อมูลบันทึกในแท็บนี้เท่านั้น ปิดแท็บแล้วข้อมูลจะหายไป", "Saved in this tab only — closing the tab erases it")}
          </p>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 space-y-2 lg:hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t(`ขั้นที่ ${index + 1} จาก ${total + 1}`, `Step ${index + 1} of ${total + 1}`)}
              </span>
              <span>{tr(step.title)}</span>
            </div>
            <StepDots total={total + 1} current={index} />
          </div>

          <form onSubmit={next} className="surface animate-rise" key={step.id} noValidate>
            <div className="border-b border-border px-5 py-5 sm:px-7">
              <p className="font-mono text-xs text-signal">
                {t("ขั้นตอนที่", "Step")} {String(index + 1).padStart(2, "0")}
              </p>
              <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-semibold tracking-tight outline-none">
                {tr(step.title)}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{tr(step.description)}</p>
            </div>

            <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
              {step.fields.map((f) => (
                <FieldInput key={f.name} field={f} data={task.data} error={errors[f.name]} onChange={onChange} />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/40 px-5 py-4 sm:px-7">
              <Button type="button" variant="outline" disabled={index === 0} onClick={() => goTo(index - 1)}>
                <ArrowLeft /> {t("ย้อนกลับ", "Back")}
              </Button>
              <Button type="submit" variant={index === total - 1 ? "signal" : "default"}>
                {index === total - 1 ? t("ตรวจทานข้อมูล", "Review details") : t("ถัดไป", "Next")} <ArrowRight />
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
