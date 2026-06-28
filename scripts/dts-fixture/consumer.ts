import { defineConfig } from "@verbatra/sdk";

export const anthropicConfig = defineConfig({
  sourceLocale: "en",
  targetLocales: ["de"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: {
    id: "anthropic",
    options: { model: "claude-sonnet-4-5-20250929", maxTokens: 1024 },
  },
});

export const openaiConfig = defineConfig({
  sourceLocale: "en",
  targetLocales: ["de"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: {
    id: "openai",
    options: { model: "gpt-4o", maxOutputTokens: 1024 },
  },
});

export const geminiConfig = defineConfig({
  sourceLocale: "en",
  targetLocales: ["de"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: {
    id: "gemini",
    options: { model: "gemini-2.5-flash", maxOutputTokens: 1024 },
  },
});

export const deeplConfig = defineConfig({
  sourceLocale: "en",
  targetLocales: ["de"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: {
    id: "deepl",
    options: {},
  },
});

defineConfig({
  sourceLocale: "en",
  targetLocales: ["de"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: {
    id: "anthropic",
    // @ts-expect-error the model field is the Anthropic literal union, so a nonsense id is rejected.
    options: { model: "not-a-real-anthropic-model", maxTokens: 1024 },
  },
});
