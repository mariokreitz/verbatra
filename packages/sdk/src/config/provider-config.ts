import {
  anthropicConfigSchema,
  createAnthropicProvider,
  createDeepLProvider,
  createGeminiProvider,
  createOpenAiProvider,
  deepLConfigSchema,
  geminiConfigSchema,
  openAiConfigSchema,
  type TranslationProvider,
} from "@verbatra/ai-providers";
import { z } from "zod";

/**
 * The provider section of the config: a discriminated union over the provider id,
 * reusing each provider's own exported config schema. There is no key field anywhere
 * in this union. The provider reads its API key from the environment at construction.
 *
 * This union and the factory table below are co-located on purpose: adding a provider
 * is a single edit here (one union variant plus one table entry), and the mapped-type
 * table makes the two sets provably identical at compile time.
 */
export const providerConfigSchema = z.discriminatedUnion("id", [
  z.object({ id: z.literal("anthropic"), options: anthropicConfigSchema.strict() }),
  z.object({ id: z.literal("openai"), options: openAiConfigSchema.strict() }),
  z.object({ id: z.literal("gemini"), options: geminiConfigSchema.strict() }),
  z.object({ id: z.literal("deepl"), options: deepLConfigSchema.strict() }),
]);

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ProviderId = ProviderConfig["id"];

/**
 * id -> ai-providers factory. The mapped type keys this exactly to the union's id set:
 * a provider added to the union but missing here (or vice versa) fails to compile, so
 * the two can never drift. Each factory receives that id's already-validated options.
 */
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
};

/**
 * Construct the configured provider from its validated config. The id and options are
 * correlated by the discriminated union; re-associate them for the indexed factory
 * call. The mapped-type table guarantees a factory exists for every id. The factory
 * reads the API key from the environment; this function never sees or passes a key.
 */
export function buildProvider(config: ProviderConfig): TranslationProvider {
  const create = providerFactories[config.id] as (
    options: ProviderConfig["options"],
  ) => TranslationProvider;
  return create(config.options);
}
