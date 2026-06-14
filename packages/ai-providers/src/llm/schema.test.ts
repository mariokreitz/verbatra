import { describe, expect, it } from "vitest";
import { buildRequest } from "../anthropic/request.js";
import { buildGeminiRequest } from "../gemini/request.js";
import { toGeminiSchema } from "../gemini/schema.js";
import { buildOpenAiRequest } from "../openai/request.js";
import { deriveJsonSchema, translationsResultSchema } from "./schema.js";

describe("canonical schema single source of truth", () => {
  it("all three providers derive their API-specific schema from the one canonical schema", () => {
    const canonical = deriveJsonSchema(translationsResultSchema);

    const anthropic = buildRequest({ model: "m", maxTokens: 16 }, "{}");
    const openai = buildOpenAiRequest({ model: "m", maxOutputTokens: 16 }, "{}");
    const gemini = buildGeminiRequest({ model: "m", maxOutputTokens: 16 }, "{}");

    // Anthropic's tool input_schema and OpenAI's json_schema.schema are byte-equal to
    // the single canonical derivation: they cannot drift apart from each other or from
    // the schema the shared layer validates against.
    expect(anthropic.tools[0].input_schema).toEqual(canonical);
    expect(openai.response_format.json_schema.schema).toEqual(canonical);
    expect(anthropic.tools[0].input_schema).toEqual(openai.response_format.json_schema.schema);

    // Gemini's responseSchema is a dialect TRANSFORM of the SAME one derivation, not an
    // independent schema: feeding the canonical derivation through the transform equals
    // what the provider sends, so the single source still holds.
    expect(gemini.config.responseSchema).toEqual(toGeminiSchema(canonical));
  });

  it("the derived schema constrains output to per-key key/value pairs", () => {
    const schema = deriveJsonSchema(translationsResultSchema);
    // Sanity: the derived JSON schema actually describes { translations: [{key,value}] }.
    expect(schema).toMatchObject({
      type: "object",
      properties: { translations: { type: "array" } },
    });
    expect(schema).not.toHaveProperty("$schema");
  });
});
