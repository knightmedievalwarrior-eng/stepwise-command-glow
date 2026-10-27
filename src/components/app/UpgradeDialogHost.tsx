import { TRIAL_DAYS, trialDaysLeft, useTrialStart } from "@/lib/trial";
import { setUpgradeOpen, useUpgradeOpen } from "@/lib/upgrade";

import { UpgradeDialog } from "./TrialBadge";

/**
 * Mounted once in the root: renders the shared upgrade dialog whenever any
 * part of the app (trial badge, locked themes) calls `openUpgrade()`.
 */
export function UpgradeDialogHost() {
  const open = useUpgradeOpen();
  const startedAt = useTrialStart();
  if (!open) return null;

  const daysLeft = startedAt === null ? TRIAL_DAYS : trialDaysLeft(startedAt, Date.now());
  return <UpgradeDialog open={open} onOpenChange={setUpgradeOpen} daysLeft={daysLeft} />;
}
