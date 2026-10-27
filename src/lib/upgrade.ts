/** Opens the upgrade window from anywhere (trial badge, locked themes). */
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function setUpgradeOpen(next: boolean) {
  open = next;
  listeners.forEach((l) => l());
}

export const openUpgrade = () => setUpgradeOpen(true);

export function useUpgradeOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}
