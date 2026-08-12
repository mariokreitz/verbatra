import ExcelJS from "exceljs";
import { ExchangeError } from "./errors.js";
import { COLUMN, HEADER_ROW, HEADERS, INSTRUCTIONS_SHEET_NAME } from "./layout.js";
import { DEFAULT_WORKBOOK_LIMITS, type WorkbookLimits } from "./limits.js";
import { judgeRow, type RowAccumulator } from "./row-shape.js";
import type {
  WorkbookData,
  WorkbookDuplicateKey,
  WorkbookRowProblem,
  WorkbookSheet,
} from "./types.js";
import { guardWorkbookBytes } from "./zip-guard.js";

/** Options for {@link readWorkbook}; the caps default to {@link DEFAULT_WORKBOOK_LIMITS}. */
export interface ReadWorkbookOptions {
  readonly limits?: WorkbookLimits;
}

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
  /* v8 ignore next -- exceljs's Cell#text always returns Value#toString(), which is always a string; this fallback guards a case the public exceljs API cannot produce, kept only because the input is untrusted. */
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
 * Read one worksheet row's cells left to right into the positional cell list {@link judgeRow} judges,
 * so the xlsx reader and the delimited reader share one column-to-field mapping.
 */
function sheetRowCells(row: ExcelJS.Row): readonly string[] {
  return HEADERS.map((_, index) => cellString(row.getCell(index + 1)));
}

/** One data sheet's parsed rows plus the structural problems the SDK import layer will judge. */
interface DataSheetRead {
  readonly sheet: WorkbookSheet;
  readonly malformed: readonly WorkbookRowProblem[];
  readonly duplicates: readonly WorkbookDuplicateKey[];
}

/**
 * Enforce the per-row cell cap on one worksheet row, before its cells are read into the shared judge
 * step.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` on a cells-per-row breach
 */
function assertRowCellCap(row: ExcelJS.Row, sheetName: string, limits: WorkbookLimits): void {
  if (row.cellCount > limits.maxCellsPerRow) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The sheet "${sheetName}" has a row with more than the maximum of ${limits.maxCellsPerRow} cells.`,
    );
  }
}

/**
 * Read one data sheet: verify the header, enforce the per-sheet and per-row caps, then judge every row
 * through the shared {@link judgeRow} step. The locale is taken from the sheet name. This decides no
 * policy: a malformed row and a duplicate key are reported as structured data (never thrown), the first
 * occurrence of a key wins its place in `rows` and every later occurrence is reported as a duplicate,
 * and the SDK import layer judges what to do with all of it.
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
  const into: RowAccumulator = {
    rows: [],
    malformed: [],
    duplicates: [],
    seenKeys: new Set<string>(),
  };
  for (let rowNumber = HEADER_ROW + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    assertRowCellCap(row, sheet.name, limits);
    judgeRow(sheetRowCells(row), sheet.name, { row: rowNumber }, into);
  }
  return {
    sheet: { locale: sheet.name, rows: into.rows },
    malformed: into.malformed,
    duplicates: into.duplicates,
  };
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
