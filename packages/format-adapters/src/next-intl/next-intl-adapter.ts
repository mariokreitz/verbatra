import type { FormatAdapter } from "../adapter.js";
import { icuDeriveEntry, icuInvalidKeys, icuIsValid, icuPlaceholders } from "../icu/analyze.js";
import { compareIcuPlaceholders } from "../icu/compare.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";

export function createNextIntlJsonAdapter(): FormatAdapter {
  return createJsonFileAdapter({
    format: "next-intl-json",
    extractPlaceholders: icuPlaceholders,
    deriveEntry: icuDeriveEntry,
    computeInvalidIcuKeys: icuInvalidKeys,
    validateMessage: icuIsValid,
    comparePlaceholders: compareIcuPlaceholders,
  });
}
