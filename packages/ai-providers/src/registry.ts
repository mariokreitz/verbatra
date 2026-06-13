import type { TranslationProvider } from "./provider.js";

/** Outcome of resolving a provider by id. Structured; never throws. */
export type ProviderResolution =
  | { readonly status: "resolved"; readonly provider: TranslationProvider }
  | { readonly status: "unknown"; readonly id: string; readonly known: readonly string[] };

/**
 * Holds the registered providers and resolves one by id. Open for extension: a new
 * provider attaches through register without changing existing providers or the
 * resolution logic. Resolving an unknown id yields a defined, structured outcome.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, TranslationProvider>();

  register(provider: TranslationProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  resolve(id: string): ProviderResolution {
    const provider = this.providers.get(id);
    if (provider === undefined) {
      return { status: "unknown", id, known: [...this.providers.keys()] };
    }
    return { status: "resolved", provider };
  }
}
