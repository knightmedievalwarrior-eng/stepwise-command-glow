/**
 * Paid-plan flag for this browser. There is no server, so a payment is
 * confirmed by the admin, who switches this browser to the paid plan.
 */
import { useSyncExternalStore } from "react";

export const PLAN_KEY = "gtr.plan.v1";

let cache: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (cache !== null) return cache;
  if (typeof window === "undefined") return false;
  cache = window.localStorage.getItem(PLAN_KEY) === "pro";
  return cache;
}

export function isPro(): boolean {
  return read();
}

export function setPro(pro: boolean) {
  cache = pro;
  if (typeof window !== "undefined") {
    if (pro) window.localStorage.setItem(PLAN_KEY, "pro");
    else window.localStorage.removeItem(PLAN_KEY);
  }
  listeners.forEach((l) => l());
}

export function usePro(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
}

/** Test helper. */
export function __resetPlanForTests() {
  cache = null;
}
