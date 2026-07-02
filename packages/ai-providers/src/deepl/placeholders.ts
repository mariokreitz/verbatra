import type { TranslationEntry } from "@verbatra/core";

/**
 * The static, secret-free message for the {@link ProviderNoticeCode} `PLACEHOLDER_UNSUPPORTED`
 * notice. It names no key and carries no translatable content, exactly like the other DeepL
 * degradation messages.
 */
export const PLACEHOLDER_UNSUPPORTED_MESSAGE =
  "Some entries contain placeholders or ICU syntax that DeepL cannot preserve; they were left untranslated. Use an LLM provider to translate placeholder-bearing strings.";

/**
 * The result of splitting a batch by whether DeepL can safely translate each entry. Both arrays are
 * order-preserving subsequences of the input, so a positional zip of the DeepL result back onto
 * `protectable` stays valid.
 */
export interface PlaceholderPartition {
  /** Placeholder-free entries; safe to send to DeepL. */
  readonly protectable: readonly TranslationEntry[];
  /** Placeholder- or ICU-bearing entries; withheld, never sent to DeepL. */
  readonly unprotectable: readonly TranslationEntry[];
}

/**
 * Partition entries by their core-derived placeholder set. An entry is unprotectable when
 * `entry.placeholders.length > 0` (DeepL would translate or mangle the tokens); otherwise it is
 * protectable. This reuses the same `entry.placeholders` array the integrity check reads as the
 * source placeholder set; it never re-extracts placeholders. Input order is preserved within each
 * partition, so `protectable` remains an order-preserving subsequence and a positional zip of the
 * DeepL result is safe.
 *
 * @param entries - The batch entries, in request order.
 * @returns The protectable and unprotectable entries, each in the original relative order.
 */
export function partitionByPlaceholders(
  entries: readonly TranslationEntry[],
): PlaceholderPartition {
  const protectable: TranslationEntry[] = [];
  const unprotectable: TranslationEntry[] = [];
  for (const entry of entries) {
    if (entry.placeholders.length > 0) {
      unprotectable.push(entry);
    } else {
      protectable.push(entry);
    }
  }
  return { protectable, unprotectable };
}
