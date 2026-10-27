import type { StepProgress } from "@/lib/n8n/protocol";
import { cn } from "@/lib/utils";

/** Compact segmented progress bar: one segment per bot step. */
export function StepSegments({
  progress,
  labels,
  active,
  className,
}: {
  progress: StepProgress;
  labels: string[];
  active: boolean;
  className?: string;
}) {
  const failedIndex = progress.failed?.index;
  return (
    <div className={cn("flex h-1.5 gap-0.5", className)} aria-hidden>
      {labels.map((label, i) => {
        const done = i < progress.completed;
        const failed = i === failedIndex;
        const current = !done && !failed && active && i === progress.current;
        return (
          <div key={label} className="relative flex-1 overflow-hidden rounded-full bg-secondary" title={label}>
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
                done && (progress.finished ? "bg-success" : "bg-signal"),
                failed && "bg-destructive",
                current && "progress-stripes animate-stripes bg-signal/70",
              )}
              style={{ width: done || failed ? "100%" : current ? "50%" : "0%" }}
            />
          </div>
        );
      })}
    </div>
  );
}
