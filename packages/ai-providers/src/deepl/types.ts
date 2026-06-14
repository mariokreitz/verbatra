import type { TranslateResult } from "../provider.js";

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
 * network is never touched; production wraps the real deepl-node Translator/DeepLClient.
 * The `freeAccount` flag is derived from the auth key (ends in ":fx") at construction,
 * so the mechanism never sees the key itself.
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

/** Stable codes for the DeepL graceful-degradation notices. */
export type ProviderNoticeCode = "FORMALITY_DOWNGRADED" | "GLOSSARY_IGNORED";

/**
 * An observable, structured signal that something was gracefully degraded (not an
 * error). Carries only a stable code and a static message — never a key or content.
 */
export interface ProviderNotice {
  readonly code: ProviderNoticeCode;
  readonly message: string;
}

/**
 * The DeepL-specific result: the shared TranslateResult plus observable notices. DeepL's
 * translateBatch is typed as Promise<TranslateResult> so the shared interface stays
 * untouched; the concrete object additionally carries `notices`, exposed via this type.
 */
export type DeepLTranslateResult = TranslateResult & {
  readonly notices: readonly ProviderNotice[];
};
