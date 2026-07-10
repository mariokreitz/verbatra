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

  it("strips a fence preceded by conversational preamble", () => {
    const completion = openAiCompletion({
      content:
        'Sure, here is the translation:\n```json\n{"translations":[{"key":"a","value":"A"}]}\n```',
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("strips a fence followed by trailing prose", () => {
    const completion = openAiCompletion({
      content:
        '```json\n{"translations":[{"key":"a","value":"A"}]}\n```\nLet me know if you need anything else.',
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("strips a fence with both preamble and trailing prose", () => {
    const completion = openAiCompletion({
      content:
        'Here you go:\n```json\n{"translations":[{"key":"a","value":"A"}]}\n```\nHope that helps!',
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("parses a fenced JSON value whose string contains an embedded code fence", () => {
    const value = "Run this:\n```bash\necho hi\n```\nThen continue.";
    const completion = openAiCompletion({
      content: `\`\`\`json\n${JSON.stringify({ translations: [{ key: "docs.example", value }] })}\n\`\`\``,
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "docs.example", value }] });
  });

  it("skips a non-JSON example block and extracts the real JSON answer that follows", () => {
    const completion = openAiCompletion({
      content:
        'Example format:\n```json\n{ "translations": [ { "key": "example", "value": ... } ] }\n```\n\n' +
        'Actual translation:\n```json\n{"translations":[{"key":"a","value":"A"}]}\n```',
    });
    const result = extractOpenAiResult(completion, true);
    expect(result.raw).toEqual({ translations: [{ key: "a", value: "A" }] });
  });

  it("fails as INVALID_RESPONSE for a genuinely malformed, truncated response", () => {
    const completion = openAiCompletion({
      content: '```json\n{"translations": [{"key": "a", "value": "A"',
    });
    try {
      extractOpenAiResult(completion, true);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });

  it("fails as INVALID_RESPONSE when the only balanced block is not valid JSON", () => {
    const completion = openAiCompletion({ content: "{ not valid json }" });
    try {
      extractOpenAiResult(completion, true);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });
});
