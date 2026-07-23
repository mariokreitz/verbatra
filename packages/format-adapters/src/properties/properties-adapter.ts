import type { FormatAdapter } from "../adapter.js";
import { createFlatFileAdapter } from "../flat/flat-file-adapter.js";
import { parsePropertiesEntries, serializePropertiesEntries } from "./parse.js";
import { extractPropertiesPlaceholders } from "./placeholders.js";

/**
 * The Java/Spring `.properties` adapter. Reads a flat key/value file (keys kept verbatim, never split
 * into a tree), decoding the standard escapes and `\uXXXX`. Writes back canonically with `=`
 * separators and ASCII-safe `\uXXXX` escapes for non-ASCII, preserving the destination file's
 * comments, blank lines, and key order. Detection is by the `.properties` extension alone.
 *
 * @returns A `FormatAdapter` for `properties`.
 * @example
 * ```ts
 * const adapter = createPropertiesAdapter();
 * const { resource } = await adapter.read("messages_de.properties", "de");
 * ```
 */
export function createPropertiesAdapter(): FormatAdapter {
  return createFlatFileAdapter({
    format: "properties",
    extensions: [".properties"],
    parseEntries: parsePropertiesEntries,
    serializeEntries: serializePropertiesEntries,
    extractPlaceholders: extractPropertiesPlaceholders,
  });
}
