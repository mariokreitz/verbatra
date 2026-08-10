import { UTF8_BOM } from "./build-delimited.js";
import { DELIMITER, type DelimitedFormat } from "./delimited-format.js";
import { DEFAULT_DELIMITED_LIMITS, type DelimitedLimits } from "./delimited-limits.js";
import { ExchangeError } from "./errors.js";
import { COLUMN, HEADERS } from "./layout.js";
import { MALFORMED_ROW_COLUMN, parseRowCells } from "./row-shape.js";
import type {
  WorkbookData,
  WorkbookDuplicateKey,
  WorkbookRow,
  WorkbookRowProblem,
} from "./types.js";

const QUOTE = '"';

/** The 1-based record number the header occupies; data records start at the next one. */
const HEADER_RECORD = 1;

/** What {@link readDelimited} needs: the file text, the locale its name carried, and its format. */
export interface ReadDelimitedInput {
  /** The decoded file text. A leading UTF-8 BOM is consumed, never read as part of the first key. */
  readonly text: string;
  /** The target locale this file is for, taken from its file name (a delimited file has no sheets). */
  readonly locale: string;
  /** The delimited format the file was written in, which decides the field delimiter. */
  readonly format: DelimitedFormat;
}

/** Options for {@link readDelimited}; the caps default to {@link DEFAULT_DELIMITED_LIMITS}. */
export interface ReadDelimitedOptions {
  readonly limits?: DelimitedLimits;
}

/** One scanned field: its decoded value and the offset just past it. */
interface FieldScan {
  readonly value: string;
  readonly next: number;
}

/**
 * Scan a quoted field, starting just past its opening quote. A doubled quote is one literal quote; the
 * field ends at the first single quote. An unterminated quoted field consumes the rest of the text,
 * which the record's field count then reports as malformed rather than throwing.
 */
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

/** Scan an unquoted run, which ends at the delimiter, at a line break, or at the end of the text. */
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

/**
 * Scan one field. A field that opens with a quote is quoted; anything a writer left after its closing
 * quote is appended literally rather than rejected, so a hand-edited file still yields its other fields.
 */
function scanField(text: string, start: number, delimiter: string): FieldScan {
  if (text[start] !== QUOTE) {
    return scanPlainField(text, start, delimiter);
  }
  const quoted = scanQuotedField(text, start + 1);
  const trailing = scanPlainField(text, quoted.next, delimiter);
  return { value: `${quoted.value}${trailing.value}`, next: trailing.next };
}

/** One scanned record: its fields and the offset of the line break (or end of text) that closed it. */
interface RecordScan {
  readonly fields: readonly string[];
  readonly next: number;
}

/** Scan one record: fields separated by the delimiter, up to a line break or the end of the text. */
function scanRecord(text: string, start: number, delimiter: string): RecordScan {
  const fields: string[] = [];
  let cursor = start;
  for (;;) {
    const field = scanField(text, cursor, delimiter);
    fields.push(field.value);
    cursor = field.next;
    if (text[cursor] !== delimiter) {
      return { fields, next: cursor };
    }
    cursor += 1;
  }
}

/** Consume the record separator at the cursor (CRLF, LF, or a lone CR); returns the cursor unmoved at EOF. */
function consumeLineBreak(text: string, cursor: number): number {
  if (text[cursor] === "\r") {
    return text[cursor + 1] === "\n" ? cursor + 2 : cursor + 1;
  }
  return text[cursor] === "\n" ? cursor + 1 : cursor;
}

/** Split the text into records. Line breaks inside a quoted field belong to the field, not the record. */
function scanRecords(text: string, delimiter: string): readonly (readonly string[])[] {
  const records: (readonly string[])[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const record = scanRecord(text, cursor, delimiter);
    records.push(record.fields);
    const next = consumeLineBreak(text, record.next);
    if (next === record.next) {
      break;
    }
    cursor = next;
  }
  return records;
}

/**
 * Enforce the input-size cap before anything is scanned.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the text exceeds {@link DelimitedLimits.maxInputBytes}
 */
function assertInputBytes(text: string, limits: DelimitedLimits): void {
  if (Buffer.byteLength(text, "utf8") > limits.maxInputBytes) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file is larger than the maximum of ${limits.maxInputBytes} bytes.`,
    );
  }
}

/**
 * Enforce the per-record caps. Checked for every record including the header, so a crafted file cannot
 * smuggle an unbounded field or field count past the row loop.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` on a field-count or field-length breach
 */
function assertRecordBounds(fields: readonly string[], limits: DelimitedLimits): void {
  if (fields.length > limits.maxFieldsPerRow) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file has a row with more than the maximum of ${limits.maxFieldsPerRow} fields.`,
    );
  }
  for (const field of fields) {
    if (field.length > limits.maxFieldLength) {
      throw new ExchangeError(
        "WORKBOOK_INVALID",
        `The interchange file has a field longer than the maximum of ${limits.maxFieldLength} characters.`,
      );
    }
  }
}

/**
 * Enforce the record-count cap.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the file has more data records than allowed
 */
function assertRecordCount(count: number, limits: DelimitedLimits): void {
  if (count - HEADER_RECORD > limits.maxRowsPerFile) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The interchange file has more than the maximum of ${limits.maxRowsPerFile} rows.`,
    );
  }
}

/**
 * Verify the file opens with the exact {@link HEADERS} line in column order. Unlike the xlsx reader,
 * which stays tolerant of workbooks exported before the later columns existed, a delimited file has no
 * legacy shape: a header that does not match exactly means renamed, reordered, or dropped columns, and
 * importing positional fields under that assumption would write values into the wrong keys.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the header record is absent or does not match
 */
function assertHeaderRecord(records: readonly (readonly string[])[]): void {
  const header = records[0];
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

/**
 * The header label a field-count mismatch is reported on: the first column the record does not supply,
 * or the last defined column when it supplies more fields than the layout defines. Reporting a column
 * keeps the report shaped exactly like the xlsx reader's, with no field content in it.
 */
function fieldCountColumn(fieldCount: number): string {
  const label = HEADERS.at(Math.min(fieldCount, HEADERS.length - 1));
  /* v8 ignore next 3 -- HEADERS is non-empty and the index is clamped into range, so the fallback is unreachable. */
  if (label === undefined) {
    return MALFORMED_ROW_COLUMN;
  }
  return label;
}

/** A record that is one empty field: a blank line, which carries no row and is skipped silently. */
function isBlankRecord(fields: readonly string[]): boolean {
  return fields.length === 1 && fields[0] === "";
}

/** Everything the record loop accumulates for the one locale the file carries. */
interface DelimitedAccumulator {
  readonly rows: WorkbookRow[];
  readonly malformed: WorkbookRowProblem[];
  readonly duplicates: WorkbookDuplicateKey[];
  readonly seenKeys: Set<string>;
}

/**
 * Judge one data record: report a field-count mismatch or a failed shape check as a malformed row,
 * report a repeated key as a duplicate (the first occurrence already won its place), and otherwise keep
 * the row. Skips a blank line and a record whose Key field is empty, exactly like the xlsx reader.
 */
function readRecord(
  fields: readonly string[],
  locale: string,
  row: number,
  into: DelimitedAccumulator,
): void {
  if (isBlankRecord(fields)) {
    return;
  }
  if (fields.length !== HEADERS.length) {
    into.malformed.push({ locale, row, column: fieldCountColumn(fields.length) });
    return;
  }
  if (fields[COLUMN.key - 1] === "") {
    return;
  }
  const outcome = parseRowCells(fields);
  if (!outcome.ok) {
    into.malformed.push({ locale, row, column: outcome.column });
    return;
  }
  if (into.seenKeys.has(outcome.row.key)) {
    into.duplicates.push({ locale, key: outcome.row.key, row });
    return;
  }
  into.seenKeys.add(outcome.row.key);
  into.rows.push(outcome.row);
}

/**
 * Parse one returned `.csv` or `.tsv` back into the neutral row model, as the same {@link WorkbookData}
 * the xlsx reader returns, carrying the single sheet this file's locale names. The SDK import layer
 * therefore judges a delimited handoff through exactly the code path it judges a workbook through.
 *
 * A leading UTF-8 BOM is consumed. LF and CRLF are both accepted as record separators, and a line break
 * inside a quoted field is part of the field. Quoting is RFC 4180: a doubled quote inside a quoted
 * field is one literal quote.
 *
 * It decides no policy: it reports structure, including problems, for the SDK to judge. A malformed
 * record (a wrong field count or a failed shape check) and a duplicate key are returned as structured
 * data on {@link WorkbookData.malformedRows} and {@link WorkbookData.duplicateKeys} rather than thrown,
 * so one bad or repeated record never discards the file's good rows. Genuinely unreadable or oversized
 * input (a missing or mismatched header line, or any {@link DelimitedLimits} cap breach) surfaces as a
 * structured {@link ExchangeError} (`WORKBOOK_INVALID`); no field content or path escapes in it.
 *
 * @param input - the file text, the locale its name carried, and its format
 * @param options - optional caps; defaults to {@link DEFAULT_DELIMITED_LIMITS}
 * @returns the one parsed sheet, plus any malformed rows and duplicate keys
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` on any structural or cap failure
 */
export function readDelimited(
  input: ReadDelimitedInput,
  options: ReadDelimitedOptions = {},
): WorkbookData {
  const limits = options.limits ?? DEFAULT_DELIMITED_LIMITS;
  assertInputBytes(input.text, limits);
  const text = input.text.startsWith(UTF8_BOM) ? input.text.slice(UTF8_BOM.length) : input.text;

  const records = scanRecords(text, DELIMITER[input.format]);
  for (const fields of records) {
    assertRecordBounds(fields, limits);
  }
  assertRecordCount(records.length, limits);
  assertHeaderRecord(records);

  const into: DelimitedAccumulator = {
    rows: [],
    malformed: [],
    duplicates: [],
    seenKeys: new Set<string>(),
  };
  for (const [index, fields] of records.entries()) {
    if (index >= HEADER_RECORD) {
      readRecord(fields, input.locale, index + 1, into);
    }
  }
  return {
    sheets: [{ locale: input.locale, rows: into.rows }],
    malformedRows: into.malformed,
    duplicateKeys: into.duplicates,
  };
}
