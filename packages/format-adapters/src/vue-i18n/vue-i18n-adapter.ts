import type { FormatAdapter } from "../adapter.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { extractVueI18nPlaceholders } from "./placeholders.js";
import { isPluralValue } from "./plural.js";

export function createVueI18nJsonAdapter(): FormatAdapter {
  return createJsonFileAdapter({
    format: "vue-i18n-json",
    extractPlaceholders: extractVueI18nPlaceholders,
    deriveEntry: (_key, value) => ({
      placeholders: extractVueI18nPlaceholders(value),
      isPlural: isPluralValue(value),
    }),
  });
}
