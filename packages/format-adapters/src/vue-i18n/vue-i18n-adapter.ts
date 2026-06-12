import type { FormatAdapter } from "../adapter.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { extractVueI18nPlaceholders } from "./placeholders.js";
import { isPluralValue } from "./plural.js";

/**
 * The vue-i18n JSON adapter. Placeholders are single-brace {name}/{0} tokens and
 * isPlural is decided from a pipe in the value. vue-i18n is not ICU, so no ICU
 * validity is computed (invalidIcuKeys is always empty).
 */
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
