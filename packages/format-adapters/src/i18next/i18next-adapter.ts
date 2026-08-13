import type { FormatAdapter } from "../adapter.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { extractI18nextPlaceholders } from "./placeholders.js";
import { isPluralKey } from "./plural.js";

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
