import type { TranslationProvider } from "@verbatra/ai-providers";
import { buildProvider, type ProviderConfig } from "../config/provider-config.js";
import { SdkError } from "../errors.js";

/** Builds the provider from its config. Injectable so tests stay offline. */
export type CreateProvider = (config: ProviderConfig) => TranslationProvider;

/**
 * Construct the configured provider. The provider factory reads the API key from the environment;
 * the SDK never sees or passes the key. A missing key or invalid config surfaces here as a
 * structured, secret-free {@link SdkError}.
 */
export function selectProvider(
  config: ProviderConfig,
  createProvider: CreateProvider = buildProvider,
): TranslationProvider {
  try {
    return createProvider(config);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SdkError(
      "PROVIDER_CONSTRUCTION_FAILED",
      `Failed to construct provider "${config.id}": ${detail}`,
    );
  }
}
