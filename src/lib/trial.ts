/**
 * Free-trial clock, kept in this browser only (localStorage).
 * Stores just the trial start time — no personal data.
 */
import { useSyncExternalStore } from "react";

export const TRIAL_DAYS = 15;
export const TRIAL_KEY = "gtr.trial.v1";
const DAY_MS = 86_400_000;

/** Whole days left in the trial (rounded up), never below 0. */
export function trialDaysLeft(startedAt: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + TRIAL_DAYS * DAY_MS - now) / DAY_MS));
}

let cache: number | null = null;

function read(): number {
  if (cache !== null) return cache;
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(TRIAL_KEY));
  if (Number.isFinite(raw) && raw > 0) {
    cache = raw;
  } else {
    cache = Date.now();
    window.localStorage.setItem(TRIAL_KEY, String(cache));
  }
  return cache;
}

const noopSubscribe = () => () => {};

/** Trial start time in the browser, or null during server render. */
export function useTrialStart(): number | null {
  return useSyncExternalStore(noopSubscribe, read, () => null);
}

/** Test helper. */
export function __resetTrialForTests() {
  cache = null;
}
