import type { TranslationEntry } from "@verbatra/core";
import { ProviderError } from "../errors.js";
import type { IntegrityInput } from "../integrity.js";
import type { DeepLTextResult } from "./types.js";

const MISMATCH_MESSAGE = "The provider returned a mismatched number of translations.";

/**
 * Zip DeepL's ordered result array back to the original entry keys by position. A length
 * mismatch is rejected as INVALID_RESPONSE rather than silently zipped, since a misaligned
 * zip would produce confidently-wrong key-to-value mappings.
 *
 * @param entries - The original entries, in request order.
 * @param results - DeepL's ordered result array, expected one-per-entry.
 * @returns The per-key value map and the per-key integrity inputs for the shared check.
 * @throws {@link ProviderError} `INVALID_RESPONSE`: the result count does not match the entry count
 *   (fewer or more), so a positional zip cannot be trusted.
 */
export function zipResults(
  entries: readonly TranslationEntry[],
  results: readonly DeepLTextResult[],
): { values: Map<string, string>; integrityInputs: IntegrityInput[] } {
  const values = new Map<string, string>();
  const integrityInputs: IntegrityInput[] = [];
  const resultIter = results[Symbol.iterator]();
  for (const entry of entries) {
    const next = resultIter.next();
    if (next.done === true) {
      throw new ProviderError("INVALID_RESPONSE", MISMATCH_MESSAGE);
    }
    const translatedValue = next.value.text;
    values.set(entry.key, translatedValue);
    integrityInputs.push({
      key: entry.key,
      sourcePlaceholders: entry.placeholders,
      translatedValue,
    });
  }
  if (resultIter.next().done === false) {
    throw new ProviderError("INVALID_RESPONSE", MISMATCH_MESSAGE);
  }
  return { values, integrityInputs };
}
