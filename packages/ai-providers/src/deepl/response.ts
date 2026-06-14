import type { TranslationEntry } from "@verbatra/core";
import { ProviderError } from "../errors.js";
import type { IntegrityInput } from "../integrity.js";
import type { DeepLTextResult } from "./types.js";

const MISMATCH_MESSAGE = "The provider returned a mismatched number of translations.";

/**
 * Zip DeepL's ordered result array back to the original entry keys BY POSITION. The
 * result array must have exactly one entry per input, in order; a length mismatch
 * (fewer OR more results than inputs) is rejected as INVALID_RESPONSE rather than
 * silently zipped, since a misaligned zip would produce confidently-wrong key->value
 * mappings. Returns the per-key value map and the integrity inputs for the shared check.
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
