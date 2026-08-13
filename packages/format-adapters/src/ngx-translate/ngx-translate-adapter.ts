import type { FormatAdapter } from "../adapter.js";
import { extractDoubleBracePlaceholders } from "../i18next/placeholders.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { assertNotMixed, buildNgxWriteTree } from "./structure.js";

export function createNgxTranslateJsonAdapter(): FormatAdapter {
  return createJsonFileAdapter({
    format: "ngx-translate-json",
    extractPlaceholders: extractDoubleBracePlaceholders,
    deriveEntry: (_key, value) => ({
      placeholders: extractDoubleBracePlaceholders(value),
      isPlural: false,
    }),
    validateTree: assertNotMixed,
    buildWriteTree: buildNgxWriteTree,
    keyMode: "path-notation",
  });
}
