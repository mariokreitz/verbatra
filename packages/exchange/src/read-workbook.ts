import ExcelJS from "exceljs";
import { z } from "zod";
import { ExchangeError } from "./errors.js";
import { COLUMN, HEADER_ROW, HEADERS, INSTRUCTIONS_SHEET_NAME } from "./layout.js";
import { DEFAULT_WORKBOOK_LIMITS, type WorkbookLimits } from "./limits.js";
import type {
  RowStatus,
  WorkbookData,
  WorkbookDuplicateKey,
  WorkbookRow,
  WorkbookRowProblem,
  WorkbookSheet,
} from "./types.js";
import { guardWorkbookBytes } from "./zip-guard.js";

/** Options for {@link readWorkbook}; the caps default to {@link DEFAULT_WORKBOOK_LIMITS}. */
export interface ReadWorkbookOptions {
  readonly limits?: WorkbookLimits;
}

/**
 * The zod boundary check on untrusted workbook content: key non-empty, status a known bucket.
 * The review fields fall back via `.catch` ("ok" / "") instead of rejecting, so a legacy workbook
 * exported before the review columns existed, or an unrecognized review-status cell, still imports.
 */
const rowSchema = z.object({
  key: z.string().min(1),
  source: z.string(),
  currentTarget: z.string(),
  status: z.enum(["new", "changed", "unchanged"]),
  sourceHash: z.string(),
  translation: z.string(),
  context: z.string(),
  reviewStatus: z.enum(["ok", "review"]).catch("ok"),
  reviewReasons: z.string().catch(""),
});

/**
 * Coerce a cell value to a string verbatim, falling back to the cell's rendered text for object cells.
 * Identifier columns (Key and Source hash) are read through this untrimmed, so a key with legitimate
 * leading or trailing whitespace (legal in JSON and flat-file keys, and written verbatim by the
 * builder) round-trips exactly instead of failing to map on import.
 */
function cellString(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return typeof cell.text === "string" ? cell.text : "";
}

/**
 * Verify a data sheet carries the expected Key and Source-hash header columns.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if either identifying header is absent
 */
function assertHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(HEADER_ROW);
  const key = cellString(header.getCell(COLUMN.key));
  const sourceHash = cellString(header.getCell(COLUMN.sourceHash));
  if (key !== HEADERS[COLUMN.key - 1] || sourceHash !== HEADERS[COLUMN.sourceHash - 1]) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The sheet "${sheet.name}" is missing the expected Key and Source hash columns.`,
    );
  }
}

/**
 * The header label of the only column the row-shape check can reject a data row on. A blank-key row is
 * skipped before the shape check (see {@link readDataSheet}), and every other schema field is either an
 * unconstrained string or a tolerant `.catch` fallback, so the status enum is the sole reachable
 * failure. Named here so a malformed row can be reported by column without embedding any cell content.
 */
const MALFORMED_ROW_COLUMN = "Status";

/** The outcome of shape-checking one row: the parsed row, or the header label it was rejected on. */
type RowOutcome =
  | { readonly ok: true; readonly row: WorkbookRow }
  | { readonly ok: false; readonly column: string };

/**
 * Shape-check one worksheet row against the zod row schema at this untrusted boundary. Returns the
 * parsed row on success, or the offending column's header label on failure: the read layer reports the
 * failure as structured data instead of throwing, so one malformed row never aborts the whole sheet.
 *
 * Only the Translation value is trimmed: it is the sole editable column, so trimming is the single
 * normalization point that makes a whitespace-only cell read back as "" (treated exactly like an empty
 * cell) and lets the `[[CLEAR]]` unset sentinel match on trimmed content. Every other column, above all
 * the Key and Source-hash identifiers, is read verbatim so it round-trips exactly.
 */
function parseRow(row: ExcelJS.Row): RowOutcome {
  const candidate = {
    key: cellString(row.getCell(COLUMN.key)),
    source: cellString(row.getCell(COLUMN.source)),
    currentTarget: cellString(row.getCell(COLUMN.current)),
    status: cellString(row.getCell(COLUMN.status)) as RowStatus,
    sourceHash: cellString(row.getCell(COLUMN.sourceHash)),
    translation: cellString(row.getCell(COLUMN.translation)).trim(),
    context: cellString(row.getCell(COLUMN.context)),
    reviewStatus: cellString(row.getCell(COLUMN.reviewStatus)),
    reviewReasons: cellString(row.getCell(COLUMN.reviewReasons)),
  };
  const result = rowSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, column: MALFORMED_ROW_COLUMN };
  }
  return { ok: true, row: result.data };
}

/** One data sheet's parsed rows plus the structural problems the SDK import layer will judge. */
interface DataSheetRead {
  readonly sheet: WorkbookSheet;
  readonly malformed: readonly WorkbookRowProblem[];
  readonly duplicates: readonly WorkbookDuplicateKey[];
}

/**
 * Read one data sheet: verify the header, enforce the per-sheet and per-row caps, skip blank rows, and
 * shape-check the rest. The locale is taken from the sheet name. This decides no policy: a malformed
 * row and a duplicate key are reported as structured data (never thrown), the first occurrence of a
 * key wins its place in `rows` and every later occurrence is reported as a duplicate, and the SDK
 * import layer judges what to do with all of it.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` on a missing header or a per-sheet/per-row cap breach
 */
function readDataSheet(sheet: ExcelJS.Worksheet, limits: WorkbookLimits): DataSheetRead {
  assertHeader(sheet);
  if (sheet.rowCount - HEADER_ROW > limits.maxRowsPerSheet) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The sheet "${sheet.name}" has more than the maximum of ${limits.maxRowsPerSheet} rows.`,
    );
  }
  const rows: WorkbookRow[] = [];
  const malformed: WorkbookRowProblem[] = [];
  const duplicates: WorkbookDuplicateKey[] = [];
  const seenKeys = new Set<string>();
  for (let rowNumber = HEADER_ROW + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount > limits.maxCellsPerRow) {
      throw new ExchangeError(
        "WORKBOOK_INVALID",
        `The sheet "${sheet.name}" has a row with more than the maximum of ${limits.maxCellsPerRow} cells.`,
      );
    }
    if (cellString(row.getCell(COLUMN.key)) === "") {
      continue;
    }
    const outcome = parseRow(row);
    if (!outcome.ok) {
      malformed.push({ locale: sheet.name, row: rowNumber, column: outcome.column });
      continue;
    }
    if (seenKeys.has(outcome.row.key)) {
      duplicates.push({ locale: sheet.name, key: outcome.row.key, row: rowNumber });
      continue;
    }
    seenKeys.add(outcome.row.key);
    rows.push(outcome.row);
  }
  return { sheet: { locale: sheet.name, rows }, malformed, duplicates };
}

/**
 * Load already-bounded bytes into an exceljs workbook, mapping any parser failure to a structured,
 * secret-free error.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if exceljs cannot parse the bytes as xlsx
 */
async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new ExchangeError("WORKBOOK_INVALID", "The workbook could not be parsed as xlsx.");
  }
  return workbook;
}

/**
 * Parse a returned `.xlsx` back into the neutral row model. The bytes are first bounded by
 * {@link guardWorkbookBytes}, then exceljs parses, then each data sheet (every sheet except the
 * instructions sheet) is read with the per-sheet and per-row caps and a zod row-shape check.
 *
 * It decides no policy: it reports structure, including problems, for the SDK to judge. A malformed
 * row (one that fails the shape check) and a duplicate key (a key seen more than once in a sheet) are
 * returned as structured data on {@link WorkbookData.malformedRows} and {@link WorkbookData.duplicateKeys}
 * rather than thrown, so one bad or repeated row never discards a sheet's good rows. For a duplicated
 * key, the first occurrence keeps its place in the sheet's rows and every later occurrence is reported;
 * the SDK import layer applies the first-occurrence-wins rule. Genuinely unreadable or oversized input
 * (a non-xlsx or corrupt file, a missing identifier header, or any {@link WorkbookLimits} cap breach)
 * still surfaces as a structured {@link ExchangeError} (`WORKBOOK_INVALID`); no raw library throw,
 * buffer, path, or cell content escapes.
 *
 * @param bytes - the returned workbook bytes (already on-disk size-capped by the SDK's read)
 * @param options - optional caps; defaults to {@link DEFAULT_WORKBOOK_LIMITS}
 * @returns the parsed sheets in workbook order, plus any malformed rows and duplicate keys
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` on any structural or cap failure
 */
export async function readWorkbook(
  bytes: Uint8Array,
  options: ReadWorkbookOptions = {},
): Promise<WorkbookData> {
  const limits = options.limits ?? DEFAULT_WORKBOOK_LIMITS;
  await guardWorkbookBytes(bytes, limits);
  const workbook = await loadWorkbook(bytes);

  if (workbook.worksheets.length > limits.maxSheetCount) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The workbook has more than the maximum of ${limits.maxSheetCount} sheets.`,
    );
  }

  const sheets: WorkbookSheet[] = [];
  const malformedRows: WorkbookRowProblem[] = [];
  const duplicateKeys: WorkbookDuplicateKey[] = [];
  for (const sheet of workbook.worksheets) {
    if (sheet.name === INSTRUCTIONS_SHEET_NAME) {
      continue;
    }
    const read = readDataSheet(sheet, limits);
    sheets.push(read.sheet);
    malformedRows.push(...read.malformed);
    duplicateKeys.push(...read.duplicates);
  }
  return { sheets, malformedRows, duplicateKeys };
}
