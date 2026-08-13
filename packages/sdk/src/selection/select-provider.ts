import type { TranslationProvider } from "@verbatra/ai-providers";
import { buildProvider, type ProviderConfig } from "../config/provider-config.js";
import { errorMessage, SdkError } from "../errors.js";

/**
 * Builds a {@link TranslationProvider} from the config's `provider` block. Passed as
 * `deps.createProvider` to {@link translate}, {@link watch}, and {@link retranslateEntry}, it is the
 * seam for injecting a stub in a test or a provider the SDK does not ship.
 *
 * The default implementation dispatches on the provider ID and reads the API key from the
 * environment. A factory that throws is reported as `PROVIDER_CONSTRUCTION_FAILED`.
 */
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
