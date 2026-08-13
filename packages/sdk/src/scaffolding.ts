import { PROVIDER_ENV, SCAFFOLD_MODELS } from "@verbatra/ai-providers";
import { SUPPORTED_FORMATS } from "@verbatra/core";
import type { ProviderId } from "./config/provider-config.js";

/**
 * A provider that project scaffolding can offer out of the box. It excludes `openai-compatible`,
 * which needs a `baseUrl` and a model name that only the user can supply, so there is nothing
 * sensible to prefill.
 */
export type ScaffoldableProviderId = Exclude<ProviderId, "openai-compatible">;

const _envCoversAllProviders: Record<ScaffoldableProviderId, string> = PROVIDER_ENV;
void _envCoversAllProviders;

/**
 * The facts a project generator needs to write a first config: which environment variable each
 * provider reads its API key from, a sensible starting model per provider, and the formats the SDK
 * can handle.
 *
 * It is exported so that the CLI's `init` command and any third-party generator prompt with the
 * same values the SDK actually enforces, rather than keeping a copy that drifts. Note the key names
 * only: no key value is present or reachable here.
 */
export const scaffoldingMetadata = {
  /** The environment variable each scaffoldable provider reads its API key from. */
  providerEnv: PROVIDER_ENV,
  /** A reasonable default model to prefill per language-model provider. DeepL has none, since it takes no model. */
  scaffoldModels: SCAFFOLD_MODELS,
  /** Every i18n file format the SDK can read and write. */
  supportedFormats: SUPPORTED_FORMATS,
} as const;
