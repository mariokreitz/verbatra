import { checkPlaceholders } from "@verbatra/core";
import type { ComparePlaceholders, ExtractPlaceholders } from "../shell.js";
import { extractSingleBraceTokens } from "./tokens.js";

function fabricatedTokens(sourceValue: string, targetValue: string): readonly string[] {
  const known = new Set(extractSingleBraceTokens(sourceValue));
  const invented = new Set<string>();
  for (const token of extractSingleBraceTokens(targetValue)) {
    if (!known.has(token)) {
      invented.add(token);
    }
  }
  return [...invented].sort();
}

export function createSingleBraceFabricationComparator(
  extract: ExtractPlaceholders,
): ComparePlaceholders {
  return (sourceValue, targetValue) => {
    const format = checkPlaceholders(extract(sourceValue), extract(targetValue));
    const invented = fabricatedTokens(sourceValue, targetValue);
    if (invented.length === 0) {
      return format;
    }
    return {
      matches: false,
      missing: format.missing,
      extra: [...format.extra, ...invented].sort(),
      reordered: false,
    };
  };
}
