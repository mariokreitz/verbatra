import type { TranslationEntry } from "@verbatra/core";
import type { FormatAdapter } from "../adapter.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { analyzeIcuValue } from "./icu.js";

function extractPlaceholders(value: string): readonly string[] {
  return analyzeIcuValue(value).placeholders;
}

function computeInvalidIcuKeys(entries: ReadonlyMap<string, TranslationEntry>): readonly string[] {
  const invalid: string[] = [];
  for (const [key, entry] of entries) {
    if (!analyzeIcuValue(entry.value).valid) {
      invalid.push(key);
    }
  }
  return invalid;
}

/**
 * The next-intl JSON adapter. Values are ICU MessageFormat: placeholders are the ICU
 * argument names and rich-text tag names, isPlural follows an ICU plural/selectordinal
 * argument, and invalidIcuKeys lists values that fail to parse. The ICU body is kept
 * verbatim; nothing is resolved.
 */
export function createNextIntlJsonAdapter(): FormatAdapter {
  return createJsonFileAdapter({
    format: "next-intl-json",
    extractPlaceholders,
    deriveEntry: (_key, value) => {
      const analysis = analyzeIcuValue(value);
      return { placeholders: analysis.placeholders, isPlural: analysis.isPlural };
    },
    computeInvalidIcuKeys,
  });
}
