import type { TranslationProvider } from "@verbatra/ai-providers";
import { buildProvider, type ProviderConfig } from "../config/provider-config.js";
import { SdkError } from "../errors.js";

/** Builds the provider from its config. Injectable so tests stay offline. */
export type CreateProvider = (config: ProviderConfig) => TranslationProvider;

/**
 * Select and construct the configured provider. Construction reads the API key from the
 * environment (inside the provider factory); the SDK never sees, passes, or stores the
 * key. A missing key or invalid provider config surfaces here as a structured,
 * secret-free error (provider errors are already secret-free).
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
