import { describe, expect, it } from "vitest";
import {
  buildProvider,
  hasProviderFactory,
  PROVIDER_IDS,
  providerConfigSchema,
} from "./provider-config.js";

const validOpenAiCompatible = {
  id: "openai-compatible" as const,
  options: {
    baseUrl: "http://192.168.178.74:1234",
    model: "qwen2.5-14b-instruct",
    maxOutputTokens: 1024,
  },
};

describe("providerConfigSchema: openai-compatible", () => {
  it("accepts baseUrl, model, and maxOutputTokens with no apiKeyEnvVar", () => {
    const result = providerConfigSchema.safeParse(validOpenAiCompatible);
    expect(result.success).toBe(true);
  });

  it("accepts an optional apiKeyEnvVar naming a non-hosted variable", () => {
    const result = providerConfigSchema.safeParse({
      ...validOpenAiCompatible,
      options: { ...validOpenAiCompatible.options, apiKeyEnvVar: "LM_STUDIO_KEY" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed baseUrl with a ZodError at config-parse time, not a runtime ProviderError", () => {
    const result = providerConfigSchema.safeParse({
      ...validOpenAiCompatible,
      options: { ...validOpenAiCompatible.options, baseUrl: "not-a-url" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.constructor.name).toBe("ZodError");
  });

  it.each(["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "DEEPL_API_KEY"])(
    "rejects apiKeyEnvVar naming the hosted %s variable",
    (hostedVar) => {
      const result = providerConfigSchema.safeParse({
        ...validOpenAiCompatible,
        options: { ...validOpenAiCompatible.options, apiKeyEnvVar: hostedVar },
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects an unknown extra option (strict schema)", () => {
    const result = providerConfigSchema.safeParse({
      ...validOpenAiCompatible,
      options: { ...validOpenAiCompatible.options, unknownField: "x" },
    });
    expect(result.success).toBe(false);
  });
});

describe("buildProvider: openai-compatible", () => {
  it("constructs the provider from config with no API key set anywhere", () => {
    const provider = buildProvider(validOpenAiCompatible);
    expect(provider.id).toBe("openai-compatible");
    expect(provider.kind).toBe("llm");
  });
});

describe("hasProviderFactory: membership without construction", () => {
  it("answers true for every id the schema accepts, so the two can never drift apart", () => {
    const ids = providerConfigSchema.options.map((option) => option.shape.id.value);
    expect(ids.filter((id) => !hasProviderFactory(id))).toEqual([]);
    expect(ids.sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it("answers false for an id no factory is registered under", () => {
    expect(hasProviderFactory("mistral")).toBe(false);
    expect(hasProviderFactory("toString")).toBe(false);
  });
});
