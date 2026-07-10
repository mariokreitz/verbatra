import type { TranslationEntry } from "@verbatra/core";
import { ProviderError } from "../errors.js";
import type { IntegrityInput } from "../integrity.js";

/**
 * Pair each source entry with its translated value for the integrity check. The
 * value map is complete by the time this runs (the shared reconcile enforces exact
 * key-set equality); a missing value is therefore a structured INVALID_RESPONSE.
 */
export function toIntegrityInputs(
  entries: readonly TranslationEntry[],
  values: ReadonlyMap<string, string>,
): IntegrityInput[] {
  return entries.map((entry) => {
    const translatedValue = values.get(entry.key);
    if (translatedValue === undefined) {
      throw new ProviderError(
        "INVALID_RESPONSE",
        "The provider response is missing one or more keys.",
      );
    }
    return { key: entry.key, sourceValue: entry.value, translatedValue };
  });
}
