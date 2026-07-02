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
 * Stable codes for the DeepL graceful-degradation notices, DeepL only. These are returned DATA on a
 * successful result, NOT thrown:
 *
 * - `FORMALITY_DOWNGRADED`: a requested formality was not applied (the free tier does not support it).
 * - `GLOSSARY_IGNORED`: a supplied generic glossary was not applied.
 * - `PLACEHOLDER_UNSUPPORTED`: at least one placeholder- or ICU-bearing entry was left untranslated
 *   because DeepL cannot preserve those tokens; such entries are withheld (absent from the result maps)
 *   rather than sent to DeepL and mangled.
 */
export type ProviderNoticeCode =
  | "FORMALITY_DOWNGRADED"
  | "GLOSSARY_IGNORED"
  | "PLACEHOLDER_UNSUPPORTED";

/**
 * An observable, structured signal that something was gracefully degraded (not an
 * error). Carries only a stable code and a static message, never a key or content.
 * Surfaced as result data, never thrown; callers inspect it but need not treat it as a failure.
 */
export interface ProviderNotice {
  /** The stable {@link ProviderNoticeCode} for what was degraded. */
  readonly code: ProviderNoticeCode;
  /** A static, safe description; never a key or translatable content. */
  readonly message: string;
}

/**
 * The DeepL-specific result: the shared TranslateResult plus observable notices.
 */
export type DeepLTranslateResult = TranslateResult & {
  /** Graceful-degradation notices for this batch; empty when nothing was degraded. */
  readonly notices: readonly ProviderNotice[];
};
