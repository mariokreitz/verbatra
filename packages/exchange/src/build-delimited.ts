import { DELIMITER, type DelimitedFormat } from "./delimited-format.js";
import { HEADERS } from "./layout.js";
import { rowCells } from "./row-shape.js";
import type { WorkbookSheet } from "./types.js";

/** The RFC 4180 field quote, and its doubled form inside a quoted field. */
const QUOTE = '"';
const ESCAPED_QUOTE = '""';

/**
 * The record separator written on export. LF, always, on every platform: the point of a delimited
 * handoff is that it is diffable and git-friendly, and a platform-dependent line ending would make the
 * same export differ byte for byte between machines. The reader accepts LF and CRLF either way, so a
 * file a Windows editor rewrote still imports.
 */
const LINE_BREAK = "\n";

/**
 * The UTF-8 byte order mark. Excel reads a `.csv` without one as the system code page and mangles every
 * non-ASCII character, so `csv` is written with it. `tsv` is written without: its consumers are
 * pipelines and parsers, which a leading BOM confuses. The reader consumes a leading BOM either way,
 * so both round-trip and a hand-edited file of either shape imports.
 */
export const UTF8_BOM = "\ufeff";

/**
 * Whether a field has to be quoted: it carries the delimiter, a quote, or a line break, or it has
 * leading or trailing whitespace a consumer would otherwise be free to strip.
 */
function needsQuoting(value: string, delimiter: string): boolean {
  return (
    value.includes(delimiter) ||
    value.includes(QUOTE) ||
    value.includes("\n") ||
    value.includes("\r") ||
    value !== value.trim()
  );
}

/** Encode one field, quoting it and doubling any embedded quote when it needs quoting. */
function encodeField(value: string, delimiter: string): string {
  if (!needsQuoting(value, delimiter)) {
    return value;
  }
  return `${QUOTE}${value.replaceAll(QUOTE, ESCAPED_QUOTE)}${QUOTE}`;
}

/** Encode one record: its fields joined by the delimiter, each quoted only when it has to be. */
function encodeRecord(fields: readonly string[], delimiter: string): string {
  return fields.map((field) => encodeField(field, delimiter)).join(delimiter);
}

/**
 * Serialize one target locale's rows as delimited text: the {@link HEADERS} line in column order, then
 * one record per row in the sheet's order. Quoting is RFC 4180: a field carrying the delimiter, a
 * quote, a line break, or leading or trailing whitespace is wrapped in quotes and its own quotes are
 * doubled, so nothing in a translatable string can shift a column.
 *
 * A delimited handoff has no sheets and no cell protection, so unlike the xlsx build every field is
 * editable and the source hash is visible. An edited source hash is not silently trusted: import
 * compares it against the live source and withholds the row as drift, which is what replaces the sheet
 * protection the xlsx path gets.
 *
 * @param sheet - one target locale's rows, in the order they were computed
 * @param format - `csv` (comma, written with a UTF-8 BOM) or `tsv` (tab, written without one)
 * @returns the file text, LF-terminated, with a trailing line break
 */
export function buildDelimited(sheet: WorkbookSheet, format: DelimitedFormat): string {
  const delimiter = DELIMITER[format];
  const records = [encodeRecord(HEADERS, delimiter)];
  for (const row of sheet.rows) {
    records.push(encodeRecord(rowCells(row), delimiter));
  }
  const text = `${records.join(LINE_BREAK)}${LINE_BREAK}`;
  return format === "csv" ? `${UTF8_BOM}${text}` : text;
}
