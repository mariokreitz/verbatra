import type { TranslationEntry } from "@verbatra/core";
import { ProviderError } from "../errors.js";
import type { IntegrityInput } from "../integrity.js";
import type { DeepLTextResult } from "./types.js";

const MISMATCH_MESSAGE = "The provider returned a mismatched number of translations.";

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
      sourceValue: entry.value,
      translatedValue,
    });
  }
  if (resultIter.next().done === false) {
    throw new ProviderError("INVALID_RESPONSE", MISMATCH_MESSAGE);
  }
  return { values, integrityInputs };
}
