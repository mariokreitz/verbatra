import { PROVIDER_ENV, SCAFFOLD_MODELS } from "@verbatra/ai-providers";
import { SUPPORTED_FORMATS } from "@verbatra/core";
import type { ProviderId } from "./config/provider-config.js";

export type ScaffoldableProviderId = Exclude<ProviderId, "openai-compatible">;

const _envCoversAllProviders: Record<ScaffoldableProviderId, string> = PROVIDER_ENV;
void _envCoversAllProviders;

export const scaffoldingMetadata = {
  providerEnv: PROVIDER_ENV,
  scaffoldModels: SCAFFOLD_MODELS,
  supportedFormats: SUPPORTED_FORMATS,
} as const;
