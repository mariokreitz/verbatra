import type { FormatAdapter } from "../adapter.js";
import { createFlatFileAdapter } from "../flat/flat-file-adapter.js";
import { parsePropertiesEntries, serializePropertiesEntries } from "./parse.js";
import { extractPropertiesPlaceholders } from "./placeholders.js";

export function createPropertiesAdapter(): FormatAdapter {
  return createFlatFileAdapter({
    format: "properties",
    extensions: [".properties"],
    parseEntries: parsePropertiesEntries,
    serializeEntries: serializePropertiesEntries,
    extractPlaceholders: extractPropertiesPlaceholders,
  });
}
