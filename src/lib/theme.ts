/**
 * Colour themes. Light is free; every other theme needs the paid plan.
 * The choice is a UI preference kept in localStorage.
 */
import { useSyncExternalStore } from "react";

import type { Text } from "./i18n";
import { isPro } from "./plan";

export type ThemeId = "light" | "dark" | "sand" | "ocean" | "forest";

export interface ThemeDef {
  id: ThemeId;
  label: Text;
  /** Swatch colours: background, card, signal. */
  swatch: [string, string, string];
  dark: boolean;
  paid: boolean;
  special: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: "light", label: { th: "สว่าง", en: "Light" }, swatch: ["#faf8f4", "#ffffff", "#e8572c"], dark: false, paid: false, special: false },
  { id: "dark", label: { th: "มืด", en: "Dark" }, swatch: ["#16181d", "#1d2026", "#ec7a4c"], dark: true, paid: true, special: false },
  { id: "sand", label: { th: "ทรายอุ่น", en: "Warm Sand" }, swatch: ["#f3ead9", "#fbf6ec", "#b5651d"], dark: false, paid: true, special: true },
  { id: "ocean", label: { th: "ทะเลเช้า", en: "Morning Sea" }, swatch: ["#eef4f7", "#ffffff", "#0f7c8c"], dark: false, paid: true, special: true },
  { id: "forest", label: { th: "ป่าค่ำ", en: "Night Forest" }, swatch: ["#131a16", "#1a231e", "#7fbf6a"], dark: true, paid: true, special: true },
];

export const THEME_KEY = "gtr.theme.v1";
const ids = new Set<string>(THEMES.map((t) => t.id));

/** Theme actually shown: paid themes fall back to Light without the paid plan. */
export function effectiveTheme(chosen: ThemeId, pro: boolean): ThemeId {
  const def = THEMES.find((t) => t.id === chosen);
  if (!def || (def.paid && !pro)) return "light";
  return chosen;
}

let current: ThemeId | null = null;
const listeners = new Set<() => void>();

function read(): ThemeId {
  if (current) return current;
  if (typeof window === "undefined") return "light";
  const raw = window.localStorage.getItem(THEME_KEY) ?? "light";
  current = ids.has(raw) ? (raw as ThemeId) : "light";
  return current;
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  const def = THEMES.find((t) => t.id === id) ?? THEMES[0]!;
  const root = document.documentElement;
  root.classList.toggle("dark", def.dark);
  if (def.special) root.dataset["theme"] = def.id;
  else delete root.dataset["theme"];
}

/** Saves a theme; refuses paid themes without the paid plan. Returns whether it was applied. */
export function setTheme(id: ThemeId): boolean {
  const def = THEMES.find((t) => t.id === id);
  if (!def || (def.paid && !isPro())) return false;
  current = id;
  if (typeof window !== "undefined") window.localStorage.setItem(THEME_KEY, id);
  applyTheme(id);
  listeners.forEach((l) => l());
  return true;
}

export function useThemeChoice(): ThemeId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "light",
  );
}

/**
 * Runs before first paint (inline in <head>) so returning users don't see a
 * flash of the wrong theme or language. Mirrors effectiveTheme/applyTheme.
 */
export const BOOT_SCRIPT = `(function(){try{var s=localStorage,t=s.getItem("${THEME_KEY}")||"light",p=s.getItem("gtr.plan.v1")==="pro",d=document.documentElement;if(!p||["dark","sand","ocean","forest"].indexOf(t)<0)t="light";if(t==="dark"||t==="forest")d.classList.add("dark");if(t==="sand"||t==="ocean"||t==="forest")d.setAttribute("data-theme",t);if(s.getItem("gtr.lang.v1")==="en")d.lang="en";}catch(e){}})();`;

/** Test helper. */
export function __resetThemeForTests() {
  current = null;
}
