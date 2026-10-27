/**
 * Tiny TH / EN switcher. Strings live next to their use as Thai + English
 * pairs, so there is no key dictionary to keep in sync.
 * The chosen language is a UI preference kept in localStorage.
 */
import { useSyncExternalStore } from "react";

export type Lang = "th" | "en";
/** A piece of UI text in both languages. Plain strings are shown as-is. */
export type Text = { th: string; en: string };

export const LANG_KEY = "gtr.lang.v1";

let current: Lang | null = null;
const listeners = new Set<() => void>();

function read(): Lang {
  if (current) return current;
  if (typeof window === "undefined") return "th";
  current = window.localStorage.getItem(LANG_KEY) === "en" ? "en" : "th";
  return current;
}

/** Current language for non-render code (toasts, logs). Components use useT(). */
export function getLang(): Lang {
  return read();
}

export function setLang(lang: Lang) {
  current = lang;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "th",
  );
}

export function tx(text: Text | string | undefined, lang: Lang = getLang()): string {
  if (text === undefined) return "";
  return typeof text === "string" ? text : text[lang];
}

export const localeOf = (lang: Lang) => (lang === "en" ? "en-GB" : "th-TH");

/** Hook for components: `t("ไทย", "English")`, `tr(def.title)`. */
export function useT() {
  const lang = useLang();
  return {
    lang,
    locale: localeOf(lang),
    t: (th: string, en: string) => (lang === "en" ? en : th),
    tr: (text: Text | string | undefined) => tx(text, lang),
  };
}

/** Non-hook pair picker for toasts/logs created outside render. */
export const tt = (th: string, en: string) => (getLang() === "en" ? en : th);

/** Test helper. */
export function __resetLangForTests() {
  current = null;
}
