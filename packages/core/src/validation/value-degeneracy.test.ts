import { describe, expect, it } from "vitest";
import { assessValueDegeneracy } from "./value-degeneracy.js";

describe("assessValueDegeneracy: runaway repetition", () => {
  it("flags the real error-loop evidence value", () => {
    const candidate = `//* ${"error: ".repeat(24)}[]`;
    expect(assessValueDegeneracy("Something went wrong.", candidate).degenerate).toBe(true);
  });

  it("flags a phrase-level loop whose unit exceeds the token cap of shorter checks", () => {
    const candidate = "I don't know. ".repeat(10);
    expect(assessValueDegeneracy("Please try again later.", candidate).degenerate).toBe(true);
  });

  it("flags a single character repeated past the threshold", () => {
    expect(assessValueDegeneracy("Confirmation code", "a".repeat(30)).degenerate).toBe(true);
  });

  it("flags a repetition loop even when the source key is short", () => {
    const candidate = `//* ${"error: ".repeat(24)}[]`;
    expect(assessValueDegeneracy("Save", candidate).degenerate).toBe(true);
  });
});

describe("assessValueDegeneracy: runaway length", () => {
  it("flags a candidate many multiples longer than its source, with no repetition", () => {
    const source = "Save changes";
    const candidate = Array.from({ length: 40 }, (_, i) => `item${i}`).join(" ");
    expect(assessValueDegeneracy(source, candidate).degenerate).toBe(true);
  });
});

describe("assessValueDegeneracy: values that must not be flagged", () => {
  it("does not fire the length signal when the source is under the minimum length", () => {
    const candidate = "The quick brown fox jumps over the lazy dog now.";
    expect(assessValueDegeneracy("Wow", candidate).degenerate).toBe(false);
  });

  it("returns false for a very large non-degenerate candidate without a quadratic scan", () => {
    const large = Array.from({ length: 40000 }, (_, i) => i.toString(36)).join(" ");
    expect(large.length).toBeGreaterThan(100000);
    expect(assessValueDegeneracy(large, large).degenerate).toBe(false);
  });

  it("does not flag a short repetitive human value like 'ha ha ha'", () => {
    expect(assessValueDegeneracy("laughing out loud", "ha ha ha").degenerate).toBe(false);
  });

  it("does not flag a short comma-separated repeat like 'ja, ja'", () => {
    expect(assessValueDegeneracy("yes, of course", "ja, ja").degenerate).toBe(false);
  });

  it("does not flag a CJK-dense translation shorter than its source", () => {
    expect(
      assessValueDegeneracy("Please save your changes now", "立即保存您的更改").degenerate,
    ).toBe(false);
  });

  it("does not flag a list-like value whose separators do not repeat consecutively", () => {
    const source = "Available sizes for the product";
    expect(assessValueDegeneracy(source, "1, 2, 3, 4, 5, 6, 7, 8, 9, 10").degenerate).toBe(false);
  });

  it("does not flag a number embedded in an otherwise normal sentence", () => {
    const source = "Your current balance in points";
    expect(assessValueDegeneracy(source, "You have 100000000 points remaining").degenerate).toBe(
      false,
    );
  });

  it("does not flag a plain, well-formed translation", () => {
    expect(
      assessValueDegeneracy("Save your changes", "Speichern Sie Ihre Anderungen").degenerate,
    ).toBe(false);
  });

  it("does not flag a word repeated only a few times", () => {
    expect(
      assessValueDegeneracy("This is very important", "sehr sehr sehr wichtig").degenerate,
    ).toBe(false);
  });
});
