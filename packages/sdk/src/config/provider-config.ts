import {
  anthropicConfigSchema,
  createAnthropicProvider,
  createDeepLProvider,
  createGeminiProvider,
  createOpenAiCompatibleProvider,
  createOpenAiProvider,
  deepLConfigSchema,
  geminiConfigSchema,
  openAiCompatibleConfigSchema,
  openAiConfigSchema,
  type TranslationProvider,
} from "@verbatra/ai-providers";
import { z } from "zod";

/**
 * The provider section of the config: a discriminated union over the provider id, reusing each
 * provider's own config schema. There is no key field anywhere in this union except
 * openai-compatible's optional `apiKeyEnvVar`, which names an environment variable rather than carrying
 * a key value; every provider still reads its actual key from the environment at construction.
 */
export const providerConfigSchema = z.discriminatedUnion("id", [
  z.object({ id: z.literal("anthropic"), options: anthropicConfigSchema.strict() }),
  z.object({ id: z.literal("openai"), options: openAiConfigSchema.strict() }),
  z.object({ id: z.literal("gemini"), options: geminiConfigSchema.strict() }),
  z.object({ id: z.literal("deepl"), options: deepLConfigSchema.strict() }),
  z.object({
    id: z.literal("openai-compatible"),
    options: openAiCompatibleConfigSchema.strict(),
  }),
]);

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ProviderId = ProviderConfig["id"];

// Keyed to the union's id set by the mapped type, so a provider in one but not the other fails to compile.
type ProviderFactories = {
  [K in ProviderId]: (
    options: Extract<ProviderConfig, { id: K }>["options"],
  ) => TranslationProvider;
};

const providerFactories: ProviderFactories = {
  anthropic: (options) => createAnthropicProvider(options),
  openai: (options) => createOpenAiProvider(options),
  gemini: (options) => createGeminiProvider(options),
  deepl: (options) => createDeepLProvider(options),
  "openai-compatible": (options) => createOpenAiCompatibleProvider(options),
};

// The factory reads the API key from the environment; this function never sees or passes a key.
export function buildProvider(config: ProviderConfig): TranslationProvider {
  const create = providerFactories[config.id] as (
    options: ProviderConfig["options"],
  ) => TranslationProvider;
  return create(config.options);
}
