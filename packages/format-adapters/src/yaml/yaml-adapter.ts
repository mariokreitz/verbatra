import { stringify as stringifyYaml } from "yaml";
import type { FormatAdapter } from "../adapter.js";
import { extractDoubleBracePlaceholders } from "../i18next/placeholders.js";
import { createTreeFileAdapter } from "../json/tree-file-adapter.js";
import { parseYamlObject } from "./yaml-tree.js";

/**
 * The YAML adapter. YAML is a nested tree like JSON but in YAML syntax (`.yml` and `.yaml`), so it
 * rides {@link createTreeFileAdapter} and reuses the same flatten/unflatten path once parsed.
 *
 * YAML is a container, not an i18n dialect, so the single `yaml` tag assumes i18next-compatible
 * `{{double-brace}}` interpolation (the brace-only extractor shared with i18next and ngx-translate);
 * it is not ICU, isPlural is always false, and every value is valid. Detection is by extension only:
 * YAML has no single reliable leading-byte signature, and explicit format selection is the norm.
 *
 * Known limitation: YAML comments are not preserved across a write (the tree model carries values,
 * not comments), consistent with JSON having no comment concept.
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
