import { describe, expect, it } from "vitest";
import { analyzeIcuValue } from "./icu.js";

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
    expect(a.placeholders).toEqual(["{count}", "{author}"]);
    expect(a.isPlural).toBe(true);
  });

  it("deduplicates in first-appearance order", () => {
    const a = analyzeIcuValue("{name} then {name} and {count, plural, other {#}}");
    expect(a.placeholders).toEqual(["{name}", "{count}"]);
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
