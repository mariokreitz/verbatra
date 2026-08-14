import type { FormatAdapter } from "../adapter.js";
import { type AdapterFs, nodeAdapterFs } from "../fs-port.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { createSingleBraceFabricationComparator } from "../single-brace/fabrication.js";
import { extractI18nextPlaceholders } from "./placeholders.js";
import { isPluralKey } from "./plural.js";

export function createI18nextJsonAdapter(fs: AdapterFs = nodeAdapterFs): FormatAdapter {
  return createJsonFileAdapter({
    fs,
    format: "i18next-json",
    extractPlaceholders: extractI18nextPlaceholders,
    deriveEntry: (key, value) => ({
      placeholders: extractI18nextPlaceholders(value),
      isPlural: isPluralKey(key),
    }),
    comparePlaceholders: createSingleBraceFabricationComparator(extractI18nextPlaceholders),
  });
}
