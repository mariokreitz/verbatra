import { describe, expect, it } from "vitest";
import { checkBatchIntegrity } from "./integrity.js";
import { regexExtractor } from "./test-support.js";

describe("checkBatchIntegrity", () => {
  it("reports a match when placeholders are preserved", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourcePlaceholders: ["{{name}}"], translatedValue: "Hallo {{name}}" }],
      regexExtractor,
    );
    expect(result.get("a")?.matches).toBe(true);
  });

  it("reports a missing placeholder, not swallowed", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourcePlaceholders: ["{{name}}"], translatedValue: "Hallo" }],
      regexExtractor,
    );
    const outcome = result.get("a");
    expect(outcome?.matches).toBe(false);
    expect(outcome?.missing).toEqual(["{{name}}"]);
  });

  it("reports an extra placeholder", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourcePlaceholders: ["{{name}}"], translatedValue: "Hallo {{name}} {{x}}" }],
      regexExtractor,
    );
    expect(result.get("a")?.extra).toEqual(["{{x}}"]);
  });

  it("reports a reordering", () => {
    const result = checkBatchIntegrity(
      [{ key: "a", sourcePlaceholders: ["{{a}}", "{{b}}"], translatedValue: "{{b}} then {{a}}" }],
      regexExtractor,
    );
    expect(result.get("a")?.reordered).toBe(true);
  });

  it("checks every key in the batch", () => {
    const result = checkBatchIntegrity(
      [
        { key: "a", sourcePlaceholders: [], translatedValue: "x" },
        { key: "b", sourcePlaceholders: ["{{n}}"], translatedValue: "y {{n}}" },
      ],
      regexExtractor,
    );
    expect([...result.keys()]).toEqual(["a", "b"]);
  });
});
