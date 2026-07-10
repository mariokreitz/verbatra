import type { ProviderNotice, TranslateResult } from "@verbatra/ai-providers";

/**
 * Read the provider notices off a translate result. `notices` is a typed, optional field on the
 * shared {@link TranslateResult}: DeepL always populates it, every LLM provider returns a present
 * empty array, so this is a plain accessor, never a structural cast.
 */
export function readNotices(result: TranslateResult): readonly ProviderNotice[] {
  return result.notices ?? [];
}
