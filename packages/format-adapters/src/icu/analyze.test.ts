import type { TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import {
  analyzeIcuValue,
  icuDeriveEntry,
  icuInvalidKeys,
  icuIsValid,
  icuPlaceholders,
} from "./analyze.js";

function entry(key: string, value: string): TranslationEntry {
  return { key, namespace: "n", value, placeholders: [], isPlural: false };
}

describe("analyzeIcuValue: extraction", () => {
  it("extracts a simple {name} argument", () => {
    const a = analyzeIcuValue("hi {name}");
    expect(a.placeholders).toEqual(["{name}"]);
    expect(a.isPlural).toBe(false);
    expect(a.valid).toBe(true);
  });

  it("short-circuits a plain string with no ICU", () => {
    expect(analyzeIcuValue("just text")).toEqual({
      placeholders: [],
      isPlural: false,
      valid: true,
    });
  });

  it("extracts a typed argument by name only, not its body", () => {
    const a = analyzeIcuValue("{count, plural, one {# item} other {# items}}");
    expect(a.placeholders).toEqual(["{count}"]);
    expect(a.isPlural).toBe(true);
  });

  it("extracts arguments nested inside a plural branch; '#' is not a placeholder", () => {
    const a = analyzeIcuValue("{count, plural, one {# by {author}} other {# by {author}}}");
    expect(a.placeholders).toEqual(["{count}", "{author}", "{author}"]);
    expect(a.isPlural).toBe(true);
  });

  it("preserves every occurrence in document order (multiset, not deduplicated)", () => {
    const a = analyzeIcuValue("{name} then {name} and {count, plural, other {#}}");
    expect(a.placeholders).toEqual(["{name}", "{name}", "{count}"]);
  });

  it("extracts tag names; the tag body text is not a placeholder", () => {
    const a = analyzeIcuValue("click <link>here {x}</link>");
    expect(a.placeholders).toEqual(["<link>", "{x}"]);
    expect(a.isPlural).toBe(false);
  });
});

describe("analyzeIcuValue: isPlural distinction", () => {
  it("is true for selectordinal", () => {
    expect(analyzeIcuValue("{p, selectordinal, one {#st} other {#th}}").isPlural).toBe(true);
  });

  it("is false for select/gender", () => {
    const a = analyzeIcuValue("{g, select, male {Mr} female {Ms} other {Mx}}");
    expect(a.isPlural).toBe(false);
    expect(a.placeholders).toEqual(["{g}"]);
  });
});

describe("analyzeIcuValue: validity", () => {
  it("marks a plain string valid", () => {
    expect(analyzeIcuValue("Hello").valid).toBe(true);
  });

  it("marks unbalanced ICU invalid with empty placeholders", () => {
    const a = analyzeIcuValue("{count, plural, one {x");
    expect(a.valid).toBe(false);
    expect(a.placeholders).toEqual([]);
  });

  it("marks a plural missing the other clause invalid", () => {
    expect(analyzeIcuValue("{n, plural, one {x}}").valid).toBe(false);
  });

  it("treats apostrophe-escaped braces as literal text (valid, no placeholders)", () => {
    const a = analyzeIcuValue("it's a '{' literal brace");
    expect(a.valid).toBe(true);
    expect(a.placeholders).toEqual([]);
  });
});

describe("ICU adapter hooks", () => {
  it("icuPlaceholders returns the analysis placeholders", () => {
    expect(icuPlaceholders("hi {name}")).toEqual(["{name}"]);
  });

  it("icuIsValid mirrors parse validity", () => {
    expect(icuIsValid("Hello")).toBe(true);
    expect(icuIsValid("{count, plural, one {x")).toBe(false);
  });

  it("icuDeriveEntry reports placeholders and plurality, ignoring the key", () => {
    expect(icuDeriveEntry("any", "{count, plural, other {#}}")).toEqual({
      placeholders: ["{count}"],
      isPlural: true,
    });
  });

  it("icuInvalidKeys lists only the keys whose values fail to parse", () => {
    const entries = new Map<string, TranslationEntry>([
      ["ok", entry("ok", "hi {name}")],
      ["bad", entry("bad", "{count, plural, one {x")],
    ]);
    expect(icuInvalidKeys(entries)).toEqual(["bad"]);
  });
});
