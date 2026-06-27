import { PROVIDER_ENV, SCAFFOLD_MODELS } from "@verbatra/ai-providers";
import { SUPPORTED_FORMATS } from "@verbatra/core";
import type { ProviderId } from "./config/provider-config.js";

// Compile-time guard: every canonical provider id has an env var. A provider added to
// the config union without an env var entry fails to compile here, not silently at runtime.
const _envCoversAllProviders: Record<ProviderId, string> = PROVIDER_ENV;
void _envCoversAllProviders;

/**
 * Read-only metadata the CLI `init` scaffold derives its tables from, so the CLI never
 * restates provider, env-var, model, or format truth owned by core and ai-providers.
 * Plain data, assembled here as a pass-through; this module owns none of the values.
 */
export const scaffoldingMetadata = {
  /** Provider id -> the environment variable its API key is read from. Owned by ai-providers. */
  providerEnv: PROVIDER_ENV,
  /** LLM provider id -> a cosmetic default scaffold model. Owned by ai-providers. DeepL has none. */
  scaffoldModels: SCAFFOLD_MODELS,
  /** The closed set of source format ids. Owned by core. */
  supportedFormats: SUPPORTED_FORMATS,
} as const;
