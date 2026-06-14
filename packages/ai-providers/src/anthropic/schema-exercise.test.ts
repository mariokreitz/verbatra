import { describe, expect, it } from "vitest";
import { deriveJsonSchema, translationsResultSchema } from "../llm/schema.js";
import type { TranslateRequest } from "../provider.js";
import { entry, firstCall, regexExtractor, stubClient, toolMessage } from "../test-support.js";
import { createAnthropicProvider } from "./anthropic-provider.js";

const config = { model: "m", maxTokens: 64 };

function request(): TranslateRequest {
  return {
    sourceLocale: "en",
    targetLocale: "de",
    entries: [entry("greeting", "Hello {{name}}", ["{{name}}"])],
    extractPlaceholders: regexExtractor,
  };
}

// The bytes Anthropic sends genuinely changed (the tool schema is now derived from
// the canonical schema). This test exercises that path end-to-end: it proves the
// derived schema is actually what goes on the wire AND that the provider still maps a
// schema-conforming response to correct per-key values.
describe("Anthropic derived-schema is exercised through the provider", () => {
  it("carries the derived schema on the built request and still maps the response", async () => {
    const { client, calls } = stubClient(
      toolMessage([{ key: "greeting", value: "Hallo {{name}}" }]),
    );
    const result = await createAnthropicProvider(config, { client }).translateBatch(request());

    const body = firstCall(calls);
    expect(body.tools[0].input_schema).toEqual(deriveJsonSchema(translationsResultSchema));
    expect(body.tools[0].name).toBe("submit_translations");

    // The derived constraint did not break the mechanism: a conforming response maps.
    expect(result.values.get("greeting")).toBe("Hallo {{name}}");
    expect(result.integrity.get("greeting")?.matches).toBe(true);
  });
});
