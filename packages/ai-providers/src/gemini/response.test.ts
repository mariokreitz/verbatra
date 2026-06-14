import { describe, expect, it } from "vitest";
import { extractGeminiResult } from "./response.js";

describe("extractGeminiResult: empty-string blockReason guard", () => {
  it("does not treat an empty-string blockReason as blocked", () => {
    // Only a present, non-empty blockReason means the prompt was actually blocked.
    const result = extractGeminiResult({
      promptFeedback: { blockReason: "" },
      candidates: [{ finishReason: "STOP" }],
      text: JSON.stringify({ translations: [{ key: "a", value: "A" }] }),
    });
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });
});
