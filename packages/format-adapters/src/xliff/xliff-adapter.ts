import type { FormatAdapter } from "../adapter.js";
import { createFlatFileAdapter } from "../flat/flat-file-adapter.js";
import { extractXliffPlaceholders } from "./placeholders.js";
import { parseXliffEntries, serializeXliffEntries } from "./xml.js";

/** Match a leading `<xliff` or `<?xml` token, the reliable XLIFF leading-byte signature. */
function sniffXliff(sample: string): boolean {
  const head = sample.trimStart();
  return head.startsWith("<xliff") || head.startsWith("<?xml");
}

/**
 * The XLIFF adapter. XLIFF is XML (`.xlf` and `.xliff`): a flat list of trans-units rather than a
 * nested tree, so it rides {@link createFlatFileAdapter}. Parsing handles XLIFF 1.2 (file/body/
 * trans-unit) and 2.0 (file/unit/segment), keyed by the trans-unit id (falling back to resname), and
 * reads the target value over the source when present.
 *
 * Write updates the target in place: it re-reads the destination XML, writes each entry's value into
 * its `<target>` text (creating one when absent), and leaves the source, all attributes, and all
 * notes untouched, so they round-trip by construction. A missing destination raises a structured
 * `INVALID_STRUCTURE`, because source, target, and attributes cannot be synthesized from a flat
 * key/value map; standard tooling seeds the target file first. There is no native XLIFF plural, so
 * isPlural is always false and message validity is enforced at parse (so `validateMessage` is true).
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
