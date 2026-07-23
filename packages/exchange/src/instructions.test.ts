import { describe, expect, it } from "vitest";
import { INSTRUCTIONS_LINES } from "./instructions.js";

/** The instruction lines joined into one searchable block, as a translator would read them. */
const text = INSTRUCTIONS_LINES.join("\n");

describe("instructions: structure", () => {
  it("is a non-empty list of string lines", () => {
    expect(Array.isArray(INSTRUCTIONS_LINES)).toBe(true);
    expect(INSTRUCTIONS_LINES.length).toBeGreaterThan(0);
    for (const line of INSTRUCTIONS_LINES) {
      expect(typeof line).toBe("string");
    }
  });

  it("opens with a title line", () => {
    expect(INSTRUCTIONS_LINES[0]).toBe("How to use this workbook");
  });
});

describe("instructions: critical guidance", () => {
  it("names the single editable column and tells the translator to leave the rest alone", () => {
    expect(text).toContain("Fill ONLY the 'Translation' column");
    expect(text).toContain("Leave every other column unchanged");
  });

  it("explains that an empty translation cell means not translated rather than an empty value", () => {
    expect(text).toContain("not translated yet");
  });

  it("treats a whitespace-only cell the same as an empty cell", () => {
    expect(text).toContain("only spaces is treated the same as an empty cell");
  });

  it("documents the [[CLEAR]] sentinel for deliberately clearing a value", () => {
    expect(text).toContain("[[CLEAR]]");
  });

  it("warns against renaming, deleting, or reordering the language tabs", () => {
    expect(text).toContain("Do not rename, delete, or reorder the language tabs");
  });

  it("gives placeholder guidance with a concrete token kept verbatim", () => {
    expect(text).toContain("{name}");
    expect(text).toContain("must stay verbatim");
  });

  it("gives ICU guidance to preserve the ICU structure and argument names", () => {
    expect(text).toContain("ICU");
    expect(text).toContain("plural");
    expect(text).toContain("keep the ICU");
  });

  it("protects the mapping columns the import relies on", () => {
    expect(text).toContain("Key");
    expect(text).toContain("Source hash");
  });

  it("documents all three status values the diff produces", () => {
    expect(text).toContain("new");
    expect(text).toContain("changed");
    expect(text).toContain("unchanged");
  });

  it("does not claim an unchanged row's source changed", () => {
    const unchangedLine = INSTRUCTIONS_LINES.find((line) => line.trim().startsWith("unchanged"));
    expect(unchangedLine).toBeDefined();
    expect(unchangedLine).not.toContain("source string changed");
  });

  it("tells the translator the Context column is read-only reference text", () => {
    expect(text).toContain("'Context' column");
    expect(text).toContain("read-only");
  });
});
