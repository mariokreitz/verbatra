import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { checkPlaceholders } from "@verbatra/core";
import type { PlaceholderComparator, PlaceholderExtractor } from "./provider.js";

export interface IntegrityInput {
  readonly key: string;
  readonly sourceValue: string;
  readonly translatedValue: string;
}

export function checkBatchIntegrity(
  inputs: readonly IntegrityInput[],
  extract: PlaceholderExtractor,
  compare?: PlaceholderComparator,
): Map<string, PlaceholderIntegrityResult> {
  const integrity = new Map<string, PlaceholderIntegrityResult>();
  for (const { key, sourceValue, translatedValue } of inputs) {
    integrity.set(
      key,
      compare !== undefined
        ? compare(sourceValue, translatedValue)
        : checkPlaceholders(extract(sourceValue), extract(translatedValue)),
    );
  }
  return integrity;
}
