import type { TranslationEntry } from "@verbatra/core";
import type { IntegrityInput } from "../integrity.js";

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
