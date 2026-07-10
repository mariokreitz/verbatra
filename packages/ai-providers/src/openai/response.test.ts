import { describe, expect, it } from "vitest";
import { ProviderError } from "../errors.js";
import { openAiCompletion } from "../test-support.js";
import { extractOpenAiResult } from "./response.js";

describe("extractOpenAiResult: default (tolerant=false)", () => {
  it("parses plain JSON content, unaffected by the new parameter's existence", () => {
    const completion = openAiCompletion({
      content: JSON.stringify({ translations: [{ key: "a", value: "A" }] }),
    });
    const result = extractOpenAiResult(completion);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("rejects fenced JSON as INVALID_RESPONSE when tolerant is not set", () => {
    const completion = openAiCompletion({
      content: '```json\n{"translations":[]}\n```',
    });
    expect(() => extractOpenAiResult(completion)).toThrow(ProviderError);
    try {
      extractOpenAiResult(completion);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });

  it("rejects fenced JSON as INVALID_RESPONSE when tolerant is explicitly false", () => {
    const completion = openAiCompletion({ content: '```\n{"translations":[]}\n```' });
    expect(() => extractOpenAiResult(completion, false)).toThrow(ProviderError);
  });
});

describe("extractOpenAiResult: tolerant=true", () => {
  it("strips a ```json fence before parsing", () => {
    const completion = openAiCompletion({
      content: '```json\n{"translations":[{"key":"a","value":"A"}]}\n```',
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("strips a bare ``` fence (no json tag) before parsing", () => {
    const completion = openAiCompletion({
      content: '```\n{"translations":[{"key":"a","value":"A"}]}\n```',
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("parses plain, unfenced JSON the same as when tolerant is false", () => {
    const completion = openAiCompletion({
      content: JSON.stringify({ translations: [{ key: "a", value: "A" }] }),
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("still throws INVALID_RESPONSE when the fenced content is not valid JSON", () => {
    const completion = openAiCompletion({ content: "```json\nnot json at all\n```" });
    try {
      extractOpenAiResult(completion, true);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });

  it("still throws INVALID_RESPONSE for prose with no JSON at all", () => {
    const completion = openAiCompletion({
      content: "Sure, here is the translation you asked for.",
    });
    try {
      extractOpenAiResult(completion, true);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });
});
