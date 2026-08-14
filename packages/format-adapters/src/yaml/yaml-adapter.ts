import { stringify as stringifyYaml } from "yaml";
import type { FormatAdapter } from "../adapter.js";
import { type AdapterFs, nodeAdapterFs } from "../fs-port.js";
import { extractDoubleBracePlaceholders } from "../i18next/placeholders.js";
import { createTreeFileAdapter } from "../json/tree-file-adapter.js";
import { createSingleBraceFabricationComparator } from "../single-brace/fabrication.js";
import { parseYamlObject } from "./yaml-tree.js";

export function createYamlAdapter(fs: AdapterFs = nodeAdapterFs): FormatAdapter {
  return createTreeFileAdapter({
    fs,
    format: "yaml",
    extensions: [".yml", ".yaml"],
    parse: parseYamlObject,
    serialize: (tree) => stringifyYaml(tree),
    extractPlaceholders: extractDoubleBracePlaceholders,
    deriveEntry: (_key, value) => ({
      placeholders: extractDoubleBracePlaceholders(value),
      isPlural: false,
    }),
    comparePlaceholders: createSingleBraceFabricationComparator(extractDoubleBracePlaceholders),
  });
}
