import type { ProviderNotice, TranslateResult } from "../provider.js";

/** A single translated result, narrowed to the field this provider reads. */
export interface DeepLTextResult {
  readonly text: string;
}

/** The translateText options this provider sets (formality and a glossary id). */
export interface DeepLTranslateOptions {
  readonly formality?: string;
  readonly glossary?: string;
}

/**
 * The minimal DeepL client surface this provider depends on. Tests inject a stub so the
 * network is never touched; production wraps the real deepl-node Translator.
 */
export interface DeepLTranslateClient {
  translateText(
    texts: readonly string[],
    sourceLang: string | null,
    targetLang: string,
    options: DeepLTranslateOptions,
  ): Promise<DeepLTextResult[]>;
}

/** A bundled DeepL client plus the key-derived free-account flag. */
export interface DeepLClientBundle {
  readonly client: DeepLTranslateClient;
  readonly freeAccount: boolean;
}

/**
 * The DeepL-specific result: the shared {@link TranslateResult} with `notices` narrowed from
 * optional to always present. {@link ProviderNotice} and {@link ProviderNoticeCode} live on the
 * shared `provider.js` module; they are re-exported from the package root alongside this type.
 */
export type DeepLTranslateResult = TranslateResult & {
  /** Graceful-degradation notices for this batch; empty when nothing was degraded. */
  readonly notices: readonly ProviderNotice[];
};
