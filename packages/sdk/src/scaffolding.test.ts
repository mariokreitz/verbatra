import { describe, expect, it } from "vitest";
import type { ProviderId } from "./config/provider-config.js";
import { providerConfigSchema } from "./config/provider-config.js";
import { scaffoldingMetadata } from "./scaffolding.js";

describe("scaffoldingMetadata", () => {
  it("exposes the three pass-through tables", () => {
    expect(Object.keys(scaffoldingMetadata).sort()).toEqual([
      "providerEnv",
      "scaffoldModels",
      "supportedFormats",
    ]);
  });

  it("maps each provider id to its environment variable name", () => {
    expect(scaffoldingMetadata.providerEnv).toEqual({
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
      deepl: "DEEPL_API_KEY",
    });
  });

  it("covers every ProviderId in providerEnv", () => {
    const providerIds = providerConfigSchema.options.map(
      (variant) => variant.shape.id.value,
    ) as ProviderId[];
    for (const id of providerIds) {
      expect(scaffoldingMetadata.providerEnv[id]).toBeTypeOf("string");
      expect(scaffoldingMetadata.providerEnv[id].length).toBeGreaterThan(0);
    }
    expect(Object.keys(scaffoldingMetadata.providerEnv).sort()).toEqual([...providerIds].sort());
  });

  it("exposes the three LLM scaffold models (DeepL omitted)", () => {
    expect(scaffoldingMetadata.scaffoldModels).toEqual({
      anthropic: "claude-sonnet-4-6",
      openai: "gpt-5.4-mini",
      gemini: "gemini-2.5-flash",
    });
  });

  it("exposes core's supported format ids", () => {
    expect(scaffoldingMetadata.supportedFormats).toContain("i18next-json");
    expect(scaffoldingMetadata.supportedFormats.length).toBeGreaterThan(0);
  });
});
