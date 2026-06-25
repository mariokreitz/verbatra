import { describe, expect, it } from "vitest";
import { ProviderError } from "../errors.js";
import { assertNotTruncated, OUTPUT_TRUNCATED_MESSAGE } from "./truncation.js";

describe("assertNotTruncated", () => {
  it("does nothing when the response was not truncated", () => {
    expect(() => assertNotTruncated(false)).not.toThrow();
  });

  it("throws a secret-free OUTPUT_TRUNCATED ProviderError when truncated", () => {
    let caught: unknown;
    try {
      assertNotTruncated(true);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect((caught as ProviderError).code).toBe("OUTPUT_TRUNCATED");
    expect((caught as ProviderError).message).toBe(OUTPUT_TRUNCATED_MESSAGE);
  });

  it("names the actionable remedy in the shared message", () => {
    expect(OUTPUT_TRUNCATED_MESSAGE).toContain("Reduce the batch size");
    expect(OUTPUT_TRUNCATED_MESSAGE).toContain("max output tokens");
  });
});
