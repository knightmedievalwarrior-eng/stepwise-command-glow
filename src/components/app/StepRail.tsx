import { Check } from "lucide-react";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StepDef } from "@/lib/tasks/definitions";

interface Props {
  steps: StepDef[];
  current: number;
  /** Index of the furthest step the user may jump to. */
  reachable: number;
  onSelect: (index: number) => void;
  extraLabel?: string;
}

export function StepRail({ steps, current, reachable, onSelect, extraLabel }: Props) {
  const { t, tr } = useT();
  const all = [
    ...steps.map((s) => ({ title: tr(s.title), description: tr(s.description) })),
    { title: extraLabel ?? t("ตรวจทาน & ยืนยัน", "Review & confirm"), description: t("ตรวจข้อมูลก่อนส่ง", "Check before sending") },
  ];
  return (
    <ol className="relative space-y-1">
      {all.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = i <= reachable && i < steps.length && !active;
        return (
          <li key={s.title}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(i)}
              className={cn(
                "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                active && "bg-card shadow-soft",
                clickable && "hover:bg-secondary",
                !clickable && !active && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[0.7rem] transition-colors",
                  done && "border-foreground bg-foreground text-background",
                  active && "border-signal bg-signal text-signal-foreground",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm font-medium", !done && !active && "text-muted-foreground")}>
                  {s.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{s.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact horizontal progress for small screens. */
export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i < current ? "bg-foreground" : i === current ? "bg-signal" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}
