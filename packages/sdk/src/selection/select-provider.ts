import type { TranslationProvider } from "@verbatra/ai-providers";
import { buildProvider, type ProviderConfig } from "../config/provider-config.js";
import { errorMessage, SdkError } from "../errors.js";

export type CreateProvider = (config: ProviderConfig) => TranslationProvider;

export function selectProvider(
  config: ProviderConfig,
  createProvider: CreateProvider = buildProvider,
): TranslationProvider {
  try {
    return createProvider(config);
  } catch (error) {
    const detail = errorMessage(error);
    throw new SdkError(
      "PROVIDER_CONSTRUCTION_FAILED",
      `Failed to construct provider "${config.id}": ${detail}`,
    );
  }
}
