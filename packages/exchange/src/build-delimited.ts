import { DELIMITER, type DelimitedFormat, QUOTE, UTF8_BOM } from "./delimited-format.js";
import { HEADERS } from "./layout.js";
import { rowCells } from "./row-shape.js";
import type { WorkbookSheet } from "./types.js";

const ESCAPED_QUOTE = '""';

const LINE_BREAK = "\n";

function needsQuoting(value: string, delimiter: string): boolean {
  return (
    value.includes(delimiter) ||
    value.includes(QUOTE) ||
    value.includes("\n") ||
    value.includes("\r") ||
    value !== value.trim()
  );
}

function encodeField(value: string, delimiter: string): string {
  if (!needsQuoting(value, delimiter)) {
    return value;
  }
  return `${QUOTE}${value.replaceAll(QUOTE, ESCAPED_QUOTE)}${QUOTE}`;
}

function encodeRecord(fields: readonly string[], delimiter: string): string {
  return fields.map((field) => encodeField(field, delimiter)).join(delimiter);
}

export function buildDelimited(sheet: WorkbookSheet, format: DelimitedFormat): string {
  const delimiter = DELIMITER[format];
  const records = [encodeRecord(HEADERS, delimiter)];
  for (const row of sheet.rows) {
    records.push(encodeRecord(rowCells(row), delimiter));
  }
  const text = `${records.join(LINE_BREAK)}${LINE_BREAK}`;
  return format === "csv" ? `${UTF8_BOM}${text}` : text;
}
