import type { FormatAdapter } from "../adapter.js";
import { extractI18nextPlaceholders } from "../i18next/placeholders.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { assertNotMixed, buildNgxWriteTree } from "./structure.js";

/**
 * The ngx-translate JSON adapter. Interpolation is {{double-brace}} (reused from the
 * i18next extractor). ngx-translate has no built-in plural or ICU, so isPlural is
 * always false and no ICU validity is computed. Files may be flat (dotted keys) or
 * nested; the original style is preserved on write and mixed files are rejected.
 */
export function createNgxTranslateJsonAdapter(): FormatAdapter {
  return createJsonFileAdapter({
    format: "ngx-translate-json",
    extractPlaceholders: extractI18nextPlaceholders,
    deriveEntry: (_key, value) => ({
      placeholders: extractI18nextPlaceholders(value),
      isPlural: false,
    }),
    validateTree: assertNotMixed,
    buildWriteTree: buildNgxWriteTree,
  });
}
