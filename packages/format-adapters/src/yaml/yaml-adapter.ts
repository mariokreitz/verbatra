import { stringify as stringifyYaml } from "yaml";
import type { FormatAdapter } from "../adapter.js";
import { extractDoubleBracePlaceholders } from "../i18next/placeholders.js";
import { createTreeFileAdapter } from "../json/tree-file-adapter.js";
import { parseYamlObject } from "./yaml-tree.js";

/**
 * The YAML adapter for `.yml` and `.yaml`, a nested tree handled like JSON. It assumes
 * i18next-compatible `{{double-brace}}` interpolation, detects by extension only, and does not
 * preserve YAML comments across a write.
 *
 * @returns A `FormatAdapter` for `yaml`. Its `read` throws the shared structured conditions documented
 *   on {@link createTreeFileAdapter}, with malformed syntax reported as `INVALID_YAML`.
 * @example
 * ```ts
 * const adapter = createYamlAdapter();
 * const { resource } = await adapter.read("locales/en.yml", "en");
 * ```
 */
export function createYamlAdapter(): FormatAdapter {
  return createTreeFileAdapter({
    format: "yaml",
    extensions: [".yml", ".yaml"],
    parse: parseYamlObject,
    serialize: (tree) => stringifyYaml(tree),
    extractPlaceholders: extractDoubleBracePlaceholders,
    deriveEntry: (_key, value) => ({
      placeholders: extractDoubleBracePlaceholders(value),
      isPlural: false,
    }),
  });
}
