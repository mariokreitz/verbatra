import { describe, expect, it } from "vitest";
import {
  parseThemePreference,
  resolveTheme,
  THEME_OPTIONS,
  type ThemePreference,
} from "./theme.js";

describe("parseThemePreference", () => {
  it.each(["system", "light", "dark"] as const)("passes %s through", (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  it("falls back to system when nothing is stored", () => {
    expect(parseThemePreference(null)).toBe("system");
  });

  it("falls back to system for an unrecognized stored value", () => {
    expect(parseThemePreference("solarized")).toBe("system");
    expect(parseThemePreference("")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("resolves an explicit preference regardless of the OS setting", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("resolves system from the OS preference", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });
});

describe("THEME_OPTIONS", () => {
  it("covers every preference exactly once, system first", () => {
    const values = THEME_OPTIONS.map((option) => option.value);
    expect(values).toEqual(["system", "light", "dark"] satisfies ThemePreference[]);
  });

  it("labels every option", () => {
    for (const option of THEME_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});
