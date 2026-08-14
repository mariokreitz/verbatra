import type { FormatAdapter } from "../adapter.js";
import { type AdapterFs, nodeAdapterFs } from "../fs-port.js";
import { extractDoubleBracePlaceholders } from "../i18next/placeholders.js";
import { createJsonFileAdapter } from "../json/json-file-adapter.js";
import { createSingleBraceFabricationComparator } from "../single-brace/fabrication.js";
import { assertNotMixed, buildNgxWriteTree } from "./structure.js";

export function createNgxTranslateJsonAdapter(fs: AdapterFs = nodeAdapterFs): FormatAdapter {
  return createJsonFileAdapter({
    fs,
    format: "ngx-translate-json",
    extractPlaceholders: extractDoubleBracePlaceholders,
    deriveEntry: (_key, value) => ({
      placeholders: extractDoubleBracePlaceholders(value),
      isPlural: false,
    }),
    comparePlaceholders: createSingleBraceFabricationComparator(extractDoubleBracePlaceholders),
    validateTree: assertNotMixed,
    buildWriteTree: buildNgxWriteTree,
    keyMode: "path-notation",
  });
}
