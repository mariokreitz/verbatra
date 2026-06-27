import type { FormatAdapter } from "../adapter.js";
import { icuDeriveEntry, icuInvalidKeys, icuIsValid, icuPlaceholders } from "../icu/analyze.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";

/**
 * The next-intl JSON adapter. Values are ICU MessageFormat: placeholders are the ICU argument names
 * and rich-text tag names, isPlural follows an ICU plural/selectordinal argument, and invalidIcuKeys
 * lists values that fail to parse. The ICU body is kept verbatim; nothing is resolved.
 *
 * @returns A `FormatAdapter` for `next-intl-json`. Its `read`/`write` throw the shared structured
 *   conditions documented on {@link createJsonFileAdapter} (INVALID_JSON, MAX_DEPTH_EXCEEDED,
 *   INVALID_STRUCTURE, INPUT_TOO_LARGE; never MIXED_STRUCTURE). Invalid ICU is RECORDED in
 *   `invalidIcuKeys`, not thrown. The ICU analysis is total.
 * @example
 * ```ts
 * const adapter = createNextIntlJsonAdapter();
 * const { resource, invalidIcuKeys } = await adapter.read("locales/en.json", "en");
 * ```
 */
export function createNextIntlJsonAdapter(): FormatAdapter {
  return createJsonFileAdapter({
    format: "next-intl-json",
    extractPlaceholders: icuPlaceholders,
    deriveEntry: icuDeriveEntry,
    computeInvalidIcuKeys: icuInvalidKeys,
    validateMessage: icuIsValid,
  });
}
