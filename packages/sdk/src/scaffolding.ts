import { PROVIDER_ENV, SCAFFOLD_MODELS } from "@verbatra/ai-providers";
import { SUPPORTED_FORMATS } from "@verbatra/core";
import type { ProviderId } from "./config/provider-config.js";

/**
 * The subset of {@link ProviderId} that `init` can scaffold: every provider with a single required
 * environment variable. "openai-compatible" is deliberately excluded: unlike every other provider it
 * has no single required environment variable, only a three-tier
 * apiKeyEnvVar/OPENAI_COMPATIBLE_API_KEY/placeholder fallback (see resolveOpenAiCompatibleKey in
 * @verbatra/ai-providers), so it does not fit the `providerEnv` table below and `init` scaffolding does
 * not offer it. This is the single source of truth for the exclusion; other packages import this type
 * rather than re-deriving `Exclude<ProviderId, "openai-compatible">` themselves.
 */
export type ScaffoldableProviderId = Exclude<ProviderId, "openai-compatible">;

// Compile-time guard: a provider id added to the config union without an env var entry fails here.
const _envCoversAllProviders: Record<ScaffoldableProviderId, string> = PROVIDER_ENV;
void _envCoversAllProviders;

/**
 * Read-only metadata the CLI `init` scaffold derives its tables from, so the CLI never restates the
 * provider, env-var, model, or format truth owned by core and ai-providers.
 */
export const scaffoldingMetadata = {
  /** Provider id -> the environment variable its API key is read from. Owned by ai-providers. */
  providerEnv: PROVIDER_ENV,
  /** LLM provider id -> a cosmetic default scaffold model. Owned by ai-providers. DeepL has none. */
  scaffoldModels: SCAFFOLD_MODELS,
  /** The closed set of source format ids. Owned by core. */
  supportedFormats: SUPPORTED_FORMATS,
} as const;
