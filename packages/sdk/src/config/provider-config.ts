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

export function buildProvider(config: ProviderConfig): TranslationProvider {
  const create = providerFactories[config.id] as (
    options: ProviderConfig["options"],
  ) => TranslationProvider;
  return create(config.options);
}
