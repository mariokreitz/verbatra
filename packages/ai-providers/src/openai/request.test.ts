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
    expect(jsonObject).toMatchObject({ max_completion_tokens: 512 });
    expect(strict).toMatchObject({ max_completion_tokens: 512 });
    expect(jsonObject.messages).toEqual(strict.messages);
  });
});

describe("buildOpenAiRequest: token limit field", () => {
  it("defaults to max_completion_tokens, unchanged from the hosted OpenAI behavior", () => {
    const body = buildOpenAiRequest(config, "{}");
    expect(body).toMatchObject({ max_completion_tokens: 512 });
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("produces the identical body whether tokenLimitField is omitted or passed explicitly as max_completion_tokens", () => {
    const omitted = buildOpenAiRequest(config, "{}");
    const explicit = buildOpenAiRequest(config, "{}", "strict-schema", "max_completion_tokens");
    expect(omitted).toEqual(explicit);
  });

  it("sends max_tokens instead when tokenLimitField is max_tokens, with no max_completion_tokens field", () => {
    const body = buildOpenAiRequest(config, "{}", "strict-schema", "max_tokens");
    expect(body).toMatchObject({ max_tokens: 512 });
    expect(body).not.toHaveProperty("max_completion_tokens");
  });

  it("keeps model, mode, and messages unaffected by the token limit field", () => {
    const completionTokens = buildOpenAiRequest(
      config,
      "{}",
      "strict-schema",
      "max_completion_tokens",
    );
    const maxTokens = buildOpenAiRequest(config, "{}", "strict-schema", "max_tokens");
    expect(maxTokens.model).toBe(completionTokens.model);
    expect(maxTokens.response_format).toEqual(completionTokens.response_format);
    expect(maxTokens.messages).toEqual(completionTokens.messages);
  });
});
