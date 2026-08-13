import { DELIMITER, type DelimitedFormat, QUOTE, UTF8_BOM } from "./delimited-format.js";
import { DEFAULT_DELIMITED_LIMITS, type DelimitedLimits } from "./delimited-limits.js";
import { ExchangeError } from "./errors.js";
import { unescapeFormulaLead } from "./formula-guard.js";
import { HEADERS } from "./layout.js";
import {
  judgeRow,
  MALFORMED_ROW_COLUMN,
  type RowAccumulator,
  type RowPosition,
} from "./row-shape.js";
import type { WorkbookData } from "./types.js";

export interface ReadDelimitedInput {
  readonly text: string;
  readonly locale: string;
  readonly format: DelimitedFormat;
}

const HEADER_RECORD_COUNT = 1;

export interface ReadDelimitedOptions {
  readonly limits?: DelimitedLimits;
}

interface FieldScan {
  readonly value: string;
  readonly next: number;
}

function scanQuotedField(text: string, start: number): FieldScan {
  const parts: string[] = [];
  let cursor = start;
  for (;;) {
    const quote = text.indexOf(QUOTE, cursor);
    if (quote === -1) {
      parts.push(text.slice(cursor));
      return { value: parts.join(""), next: text.length };
    }
    parts.push(text.slice(cursor, quote));
    if (text[quote + 1] !== QUOTE) {
      return { value: parts.join(""), next: quote + 1 };
    }
    parts.push(QUOTE);
    cursor = quote + 2;
  }
}

function scanPlainField(text: string, start: number, delimiter: string): FieldScan {
  let cursor = start;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === delimiter || char === "\n" || char === "\r") {
      break;
    }
    cursor += 1;
  }
  return { value: text.slice(start, cursor), next: cursor };
}

function scanField(text: string, start: number, delimiter: string): FieldScan {
  if (text[start] !== QUOTE) {
    const plain = scanPlainField(text, start, delimiter);
    return { value: unescapeFormulaLead(plain.value), next: plain.next };
  }
  const quoted = scanQuotedField(text, start + 1);
  const trailing = scanPlainField(text, quoted.next, delimiter);
  return {
    value: unescapeFormulaLead(`${quoted.value}${trailing.value}`),
    next: trailing.next,
  };
}

function countLineBreaks(value: string): number {
  let breaks = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\n") {
      breaks += 1;
    } else if (char === "\r") {
      breaks += 1;
      if (value[index + 1] === "\n") {
        index += 1;
      }
    }
  }
  return breaks;
}

interface RecordScan {
  readonly fields: readonly string[];
  readonly breaks: number;
  readonly next: number;
}

function scanRecord(
  text: string,
  start: number,
  delimiter: string,
  limits: DelimitedLimits,
): RecordScan {
  const fields: string[] = [];
  let breaks = 0;
  let cursor = start;
  for (;;) {
    const field = scanField(text, cursor, delimiter);
    assertFieldLength(field.value, limits);
    fields.push(field.value);
    breaks += countLineBreaks(field.value);
    assertFieldCount(fields.length, limits);
    cursor = field.next;
    if (text[cursor] !== delimiter) {
      return { fields, breaks, next: cursor };
    }
    cursor += 1;
  }
}

function consumeLineBreak(text: string, cursor: number): number {
  if (text[cursor] === "\r") {
    return text[cursor + 1] === "\n" ? cursor + 2 : cursor + 1;
  }
  return text[cursor] === "\n" ? cursor + 1 : cursor;
}

interface ScannedRecord {
  readonly fields: readonly string[];
  readonly line: number;
}

function scanRecords(
  text: string,
  delimiter: string,
  limits: DelimitedLimits,
): readonly ScannedRecord[] {
  const records: ScannedRecord[] = [];
  let cursor = 0;
  let line = 1;
  while (cursor < text.length) {
    const record = scanRecord(text, cursor, delimiter, limits);
    records.push({ fields: record.fields, line });
    assertRecordCount(records.length, limits);
    const next = consumeLineBreak(text, record.next);
    if (next === record.next) {
      break;
    }
    line += record.breaks + 1;
    cursor = next;
  }
  return records;
}

function assertInputBytes(text: string, limits: DelimitedLimits): void {
  if (Buffer.byteLength(text, "utf8") > limits.maxInputBytes) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file is larger than the maximum of ${limits.maxInputBytes} bytes.`,
    );
  }
}

function assertFieldLength(value: string, limits: DelimitedLimits): void {
  if (value.length > limits.maxFieldLength) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file has a field longer than the maximum of ${limits.maxFieldLength} characters.`,
    );
  }
}

function assertFieldCount(count: number, limits: DelimitedLimits): void {
  if (count > limits.maxFieldsPerRow) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file has a row with more than the maximum of ${limits.maxFieldsPerRow} fields.`,
    );
  }
}

function assertRecordCount(count: number, limits: DelimitedLimits): void {
  if (count - HEADER_RECORD_COUNT > limits.maxRowsPerFile) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file has more than the maximum of ${limits.maxRowsPerFile} rows.`,
    );
  }
}

function assertHeaderRecord(records: readonly ScannedRecord[]): void {
  const header = records[0]?.fields;
  if (header === undefined || header.length !== HEADERS.length) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file does not start with the expected header line of ${HEADERS.length} columns.`,
    );
  }
  for (const [index, label] of HEADERS.entries()) {
    if (header[index] !== label) {
      throw new ExchangeError(
        "WORKBOOK_INVALID",
        `The interchange file's header line does not match the expected columns (column ${index + 1} should be "${label}").`,
      );
    }
  }
}

function fieldCountColumn(fieldCount: number): string {
  const label = HEADERS.at(Math.min(fieldCount, HEADERS.length - 1));
  /* v8 ignore next 3 -- HEADERS is non-empty and the index is clamped into range, so the fallback is unreachable. */
  if (label === undefined) {
    return MALFORMED_ROW_COLUMN;
  }
  return label;
}

function isBlankRecord(fields: readonly string[]): boolean {
  return fields.length === 1 && fields[0] === "";
}

function readRecord(
  fields: readonly string[],
  locale: string,
  at: RowPosition,
  into: RowAccumulator,
): void {
  if (isBlankRecord(fields)) {
    return;
  }
  if (fields.length !== HEADERS.length) {
    into.malformed.push({ locale, ...at, column: fieldCountColumn(fields.length) });
    return;
  }
  judgeRow(fields, locale, at, into);
}

export function readDelimited(
  input: ReadDelimitedInput,
  options: ReadDelimitedOptions = {},
): WorkbookData {
  const limits = options.limits ?? DEFAULT_DELIMITED_LIMITS;
  assertInputBytes(input.text, limits);
  const text = input.text.startsWith(UTF8_BOM) ? input.text.slice(UTF8_BOM.length) : input.text;

  const records = scanRecords(text, DELIMITER[input.format], limits);
  assertHeaderRecord(records);

  const into: RowAccumulator = {
    rows: [],
    malformed: [],
    duplicates: [],
    seenKeys: new Set<string>(),
  };
  for (const [index, record] of records.entries()) {
    if (index >= HEADER_RECORD_COUNT) {
      readRecord(record.fields, input.locale, { row: index + 1, line: record.line }, into);
    }
  }
  return {
    sheets: [{ locale: input.locale, rows: into.rows }],
    malformedRows: into.malformed,
    duplicateKeys: into.duplicates,
  };
}
