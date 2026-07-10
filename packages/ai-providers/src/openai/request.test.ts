import { describe, expect, it } from "vitest";
import { deriveJsonSchema, translationsResultSchema } from "../llm/schema.js";
import { buildOpenAiRequest } from "./request.js";

const config = { model: "gpt-test", maxOutputTokens: 512 };

describe("buildOpenAiRequest: default mode", () => {
  it("defaults to strict-schema, unchanged from the hosted OpenAI behavior", () => {
    const body = buildOpenAiRequest(config, "{}");
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "translations",
        strict: true,
        schema: deriveJsonSchema(translationsResultSchema),
      },
    });
  });

  it("produces the identical body whether mode is omitted or passed explicitly as strict-schema", () => {
    const omitted = buildOpenAiRequest(config, "{}");
    const explicit = buildOpenAiRequest(config, "{}", "strict-schema");
    expect(omitted).toEqual(explicit);
  });
});

describe("buildOpenAiRequest: json-object mode", () => {
  it("sets response_format to json_object with no schema field", () => {
    const body = buildOpenAiRequest(config, "{}", "json-object");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("keeps model, token limit, and messages unaffected by the mode", () => {
    const strict = buildOpenAiRequest(config, "{}", "strict-schema");
    const jsonObject = buildOpenAiRequest(config, "{}", "json-object");
    expect(jsonObject.model).toBe(strict.model);
    expect(jsonObject.max_completion_tokens).toBe(strict.max_completion_tokens);
    expect(jsonObject.messages).toEqual(strict.messages);
  });
});
