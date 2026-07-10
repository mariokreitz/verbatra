import type { TranslationEntry } from "@verbatra/core";
import type { IntegrityInput } from "../integrity.js";

/**
 * Pair each source entry with its translated value for the integrity check. `values` may legitimately
 * omit a requested key (still missing after the bounded reconcile repair round, see `runLlmTranslation`);
 * such an entry is skipped here rather than treated as an error, since the caller surfaces "still
 * missing" as its own outcome, distinct from a placeholder-integrity mismatch.
 */
export function toIntegrityInputs(
  entries: readonly TranslationEntry[],
  values: ReadonlyMap<string, string>,
): IntegrityInput[] {
  const inputs: IntegrityInput[] = [];
  for (const entry of entries) {
    const translatedValue = values.get(entry.key);
    if (translatedValue !== undefined) {
      inputs.push({ key: entry.key, sourceValue: entry.value, translatedValue });
    }
  }
  return inputs;
}
