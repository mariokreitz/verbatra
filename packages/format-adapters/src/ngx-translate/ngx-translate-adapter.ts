import type { FormatAdapter } from "../adapter.js";
import { extractDoubleBracePlaceholders } from "../i18next/placeholders.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { assertNotMixed, buildNgxWriteTree } from "./structure.js";

/**
 * The ngx-translate JSON adapter. Interpolation is `{{double-brace}}` (the brace-only extractor
 * shared with i18next; ngx-translate has no i18next `$t()` nesting). ngx-translate has no built-in
 * plural or ICU, so isPlural is always false and no ICU validity is computed. Files may be flat (dotted keys) or nested; the original style is preserved on
 * write.
 *
 * @returns A `FormatAdapter` for `ngx-translate-json`. Its `read` throws the shared structured
 *   conditions documented on {@link createJsonFileAdapter} AND, uniquely among the adapters,
 *   `MIXED_STRUCTURE` when a file mixes flat dotted keys with nested objects (its `validateTree`);
 *   `write` throws INVALID_STRUCTURE on a key collision.
 * @example
 * ```ts
 * const adapter = createNgxTranslateJsonAdapter();
 * const { resource } = await adapter.read("locales/en.json", "en");
 * ```
 */
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
    // ngx-translate flat style uses dotted keys as path notation, not literal leaves;
    // keep the legacy non-encoding flatten so its flat/nested round-trip is unchanged.
    keyMode: "path-notation",
  });
}
