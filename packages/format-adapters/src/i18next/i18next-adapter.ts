import type { FormatAdapter } from "../adapter.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { extractI18nextPlaceholders } from "./placeholders.js";
import { isPluralKey } from "./plural.js";

/**
 * The i18next JSON adapter. Placeholders are {{double-brace}} tokens and isPlural is
 * decided from the CLDR plural suffix on the key. i18next is not ICU, so no ICU
 * validity is computed (invalidIcuKeys is always empty).
 */
export function createI18nextJsonAdapter(): FormatAdapter {
  return createJsonFileAdapter({
    format: "i18next-json",
    extractPlaceholders: extractI18nextPlaceholders,
    deriveEntry: (key, value) => ({
      placeholders: extractI18nextPlaceholders(value),
      isPlural: isPluralKey(key),
    }),
  });
}
