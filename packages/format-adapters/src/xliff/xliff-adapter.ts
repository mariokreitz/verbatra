import type { FormatAdapter } from "../adapter.js";
import { createFlatFileAdapter } from "../flat/flat-file-adapter.js";
import { extractXliffPlaceholders } from "./placeholders.js";
import { parseXliffEntries, serializeXliffEntries } from "./xml.js";

function sniffXliff(sample: string): boolean {
  const head = sample.trimStart();
  return head.startsWith("<xliff") || head.startsWith("<?xml");
}

/**
 * The XLIFF adapter for `.xlf` and `.xliff`. Handles XLIFF 1.2 and 2.0, keyed by the trans-unit id
 * (falling back to resname), reading the target value over the source when present, and writing each
 * value into its `<target>` while leaving source, attributes, and notes untouched.
 *
 * @returns A `FormatAdapter` for `xliff`.
 * @example
 * ```ts
 * const adapter = createXliffAdapter();
 * const { resource } = await adapter.read("locales/messages.de.xlf", "de");
 * ```
 */
export function createXliffAdapter(): FormatAdapter {
  return createFlatFileAdapter({
    format: "xliff",
    extensions: [".xlf", ".xliff"],
    sniff: sniffXliff,
    parseEntries: parseXliffEntries,
    serializeEntries: serializeXliffEntries,
    extractPlaceholders: extractXliffPlaceholders,
  });
}
