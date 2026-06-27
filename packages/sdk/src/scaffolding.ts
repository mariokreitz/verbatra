import { PROVIDER_ENV, SCAFFOLD_MODELS } from "@verbatra/ai-providers";
import { SUPPORTED_FORMATS } from "@verbatra/core";
import type { ProviderId } from "./config/provider-config.js";

// Compile-time guard: a provider id added to the config union without an env var entry fails here.
const _envCoversAllProviders: Record<ProviderId, string> = PROVIDER_ENV;
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
