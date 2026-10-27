import { beforeEach, describe, expect, it } from "vitest";

import { __resetLangForTests, getLang, setLang } from "@/lib/i18n";
import { __resetPlanForTests, setPro } from "@/lib/plan";
import { THEMES, __resetThemeForTests, effectiveTheme, setTheme } from "@/lib/theme";

describe("language switcher", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetLangForTests();
  });

  it("defaults to Thai", () => {
    expect(getLang()).toBe("th");
  });

  it("switches to English and remembers the choice", () => {
    setLang("en");
    expect(getLang()).toBe("en");
    expect(localStorage.getItem("gtr.lang.v1")).toBe("en");
    __resetLangForTests();
    expect(getLang()).toBe("en");
  });
});

describe("theme gating", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetThemeForTests();
    __resetPlanForTests();
  });

  it("has exactly one free theme and it is Light", () => {
    expect(THEMES.filter((def) => !def.paid).map((def) => def.id)).toEqual(["light"]);
  });

  it("free users get Light even when a paid theme is chosen", () => {
    expect(effectiveTheme("light", false)).toBe("light");
    for (const def of THEMES.filter((def) => def.paid)) {
      expect(effectiveTheme(def.id, false)).toBe("light");
    }
  });

  it("the paid plan unlocks every theme", () => {
    for (const def of THEMES) {
      expect(effectiveTheme(def.id, true)).toBe(def.id);
    }
  });

  it("setTheme refuses locked themes without the paid plan and allows them with it", () => {
    expect(setTheme("dark")).toBe(false);
    expect(localStorage.getItem("gtr.theme.v1")).toBe(null);
    setPro(true);
    expect(setTheme("dark")).toBe(true);
    expect(localStorage.getItem("gtr.theme.v1")).toBe("dark");
    setPro(false);
    expect(setTheme("sand")).toBe(false);
  });
});
