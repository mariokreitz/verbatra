/**
 * Consumer-install fixture for the published type declarations. This is not application code: it is
 * never built, imported, or shipped, and it exists only to be typechecked by `pnpm check:dts`
 * (scripts/check-build-output.mjs). The tsconfig next to it maps `@verbatra/sdk` straight at
 * packages/sdk/dist/index.d.ts, so typechecking this file exercises the declaration a consumer
 * installs from npm rather than the workspace sources behind it.
 *
 * What it guards is type-surface degradation originating in source. Each export pins one provider
 * branch of the config's discriminated union, so a provider whose options collapse to `never`, or
 * whose model field loses its literal union, fails the check here. The last call, deliberately not
 * exported, asserts the negative half: an invalid model id must still be rejected. Without it a
 * fully collapsed type would accept anything and every positive case above would keep passing.
 *
 * It cannot see the other failure class, a published declaration importing an unpublished workspace
 * package: inside this repo those specifiers still resolve through pnpm's workspace symlinks. The
 * grep in scripts/check-build-output.mjs is the load-bearing half for that one.
 */

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
