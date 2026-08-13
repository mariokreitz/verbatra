import type { TranslationProvider } from "./provider.js";

export type ProviderResolution =
  | { readonly status: "resolved"; readonly provider: TranslationProvider }
  | { readonly status: "unknown"; readonly id: string; readonly known: readonly string[] };

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
