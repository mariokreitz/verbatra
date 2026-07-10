import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { checkBatchIntegrity } from "./integrity.js";
import type { PlaceholderComparator } from "./provider.js";
import { regexExtractor } from "./test-support.js";

describe("checkBatchIntegrity: extract-only (no comparator)", () => {
  it("reports a match when placeholders are preserved", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourceValue: "Hi {{name}}", translatedValue: "Hallo {{name}}" }],
      regexExtractor,
    );
    expect(result.get("a")?.matches).toBe(true);
  });

  it("reports a missing placeholder, not swallowed", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourceValue: "Hi {{name}}", translatedValue: "Hallo" }],
      regexExtractor,
    );
    const outcome = result.get("a");
    expect(outcome?.matches).toBe(false);
    expect(outcome?.missing).toEqual(["{{name}}"]);
  });

  it("reports an extra placeholder", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourceValue: "Hi {{name}}", translatedValue: "Hallo {{name}} {{x}}" }],
      regexExtractor,
    );
    expect(result.get("a")?.extra).toEqual(["{{x}}"]);
  });

  it("reports a reordering", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourceValue: "{{a}} then {{b}}", translatedValue: "{{b}} then {{a}}" }],
      regexExtractor,
    );
    expect(result.get("a")?.reordered).toBe(true);
  });

  it("checks every key in the batch", () => {
    const result = checkBatchIntegrity(
      [
        { key: "a", sourceValue: "x", translatedValue: "x" },
        { key: "b", sourceValue: "y {{n}}", translatedValue: "y {{n}}" },
      ],
      regexExtractor,
    );
    expect([...result.keys()]).toEqual(["a", "b"]);
  });
});

describe("checkBatchIntegrity: with a comparator", () => {
  const FAKE_MISMATCH: PlaceholderIntegrityResult = {
    matches: false,
    missing: [],
    extra: ["{{fabricated}}"],
    reordered: false,
  };

  it("uses the comparator directly instead of extract plus checkPlaceholders when provided", () => {
    const calls: Array<{ source: string; translated: string }> = [];
    const compare: PlaceholderComparator = (source, translated) => {
      calls.push({ source, translated });
      return FAKE_MISMATCH;
    };

    const result = checkBatchIntegrity(
      [{ key: "a", sourceValue: "Hi {{name}}", translatedValue: "Hallo {{name}}" }],
      regexExtractor,
      compare,
    );

    // The comparator's own (fabricated) result wins, proving extract/checkPlaceholders never ran.
    expect(result.get("a")).toEqual(FAKE_MISMATCH);
    expect(calls).toEqual([{ source: "Hi {{name}}", translated: "Hallo {{name}}" }]);
  });

  it("falls back to extract plus checkPlaceholders when no comparator is supplied", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourceValue: "Hi {{name}}", translatedValue: "Hallo {{name}}" }],
      regexExtractor,
      undefined,
    );
    expect(result.get("a")?.matches).toBe(true);
  });
});
