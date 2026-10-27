import { Link, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { useT } from "@/lib/i18n";
import { percent, statusLabel } from "@/lib/n8n/protocol";
import { useLiveRuns } from "@/lib/run-store";

/** Small header pill showing any bot run in progress, from any screen. */
export function RunIndicator() {
  const runs = useLiveRuns().filter((r) => r.phase === "running" || r.phase === "paused");
  const { pathname } = useLocation();
  const { t, lang } = useT();
  const run = runs[0];
  if (!run || pathname === `/execute/${run.taskId}`) return null;
  const p = run.progress;
  return (
    <Link
      to="/execute/$taskId"
      params={{ taskId: run.taskId }}
      className="flex items-center gap-2 rounded-full border border-signal/40 bg-signal-soft px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-signal"
      aria-label={`${t("ดูสถานะบอท", "View bot status")} ${statusLabel(p, lang)}`}
    >
      <Loader2 className="size-3.5 animate-spin text-signal" />
      <span className="hidden sm:inline">{statusLabel(p, lang)}</span>
      <span className="font-mono sm:hidden">
        {Math.min(p.current + 1, p.total)}/{p.total}
      </span>
      <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-background sm:block">
        <span className="block h-full rounded-full bg-signal transition-[width]" style={{ width: `${percent(p)}%` }} />
      </span>
      {runs.length > 1 && <span className="font-mono text-[0.65rem] text-muted-foreground">+{runs.length - 1}</span>}
    </Link>
  );
}
