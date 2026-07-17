import type { FormatAdapter } from "../adapter.js";
import { extractDoubleBracePlaceholders } from "../i18next/placeholders.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { assertNotMixed, buildNgxWriteTree } from "./structure.js";

/**
 * The ngx-translate JSON adapter. Interpolation is `{{double-brace}}` (the brace-only extractor
 * shared with i18next; ngx-translate has no i18next `$t()` nesting). ngx-translate has no built-in
 * plural or ICU, so isPlural is always false and no ICU validity is computed. Files may be flat
 * (dotted keys, read as path notation rather than literal leaves) or nested; the destination's
 * style is preserved on write.
 *
 * @returns A `FormatAdapter` for `ngx-translate-json`. Its `read` throws the shared structured
 *   conditions documented on {@link createJsonFileAdapter} plus, uniquely among the adapters,
 *   `MIXED_STRUCTURE` when a file mixes flat dotted keys with nested objects (its `validateTree`);
 *   `write` throws `INVALID_STRUCTURE` on a key collision.
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
    keyMode: "path-notation",
  });
}
