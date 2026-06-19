import type { TranslationProvider } from "./provider.js";

/**
 * Outcome of resolving a provider by id. A discriminated union, so callers handle the unknown case
 * explicitly: `resolved` carries the provider; `unknown` carries the requested id and the known ids.
 */
export type ProviderResolution =
  | { readonly status: "resolved"; readonly provider: TranslationProvider }
  | { readonly status: "unknown"; readonly id: string; readonly known: readonly string[] };

/**
 * Holds the registered providers and resolves one by id. Open for extension: a new
 * provider attaches through register without changing existing providers or the
 * resolution logic. Resolving an unknown id yields a defined, structured outcome.
 *
 * @example
 * ```ts
 * const registry = new ProviderRegistry().register(createDeepLProvider());
 * const resolution = registry.resolve("deepl");
 * if (resolution.status === "resolved") {
 *   await resolution.provider.translateBatch(request);
 * }
 * ```
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, TranslationProvider>();

  /**
   * Register a provider, keyed by its `id`. Re-registering an id replaces the prior provider.
   *
   * @param provider - The provider to add.
   * @returns This registry, for chaining.
   */
  register(provider: TranslationProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  /**
   * Resolve a provider by id. Never throws: an unknown id returns an `unknown` resolution listing the
   * known ids, so the caller decides how to handle it.
   *
   * @param id - The provider id to look up.
   * @returns A {@link ProviderResolution}: `resolved` with the provider, or `unknown` with the known ids.
   */
  resolve(id: string): ProviderResolution {
    const provider = this.providers.get(id);
    if (provider === undefined) {
      return { status: "unknown", id, known: [...this.providers.keys()] };
    }
    return { status: "resolved", provider };
  }
}
