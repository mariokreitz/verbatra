import ExcelJS from "exceljs";
import { z } from "zod";
import { ExchangeError } from "./errors.js";
import { COLUMN, HEADER_ROW, HEADERS, INSTRUCTIONS_SHEET_NAME } from "./layout.js";
import { DEFAULT_WORKBOOK_LIMITS, type WorkbookLimits } from "./limits.js";
import type { RowStatus, WorkbookData, WorkbookRow, WorkbookSheet } from "./types.js";
import { guardWorkbookBytes } from "./zip-guard.js";

/** Options for {@link readWorkbook}; the caps default to {@link DEFAULT_WORKBOOK_LIMITS}. */
export interface ReadWorkbookOptions {
  readonly limits?: WorkbookLimits;
}

/** The zod boundary check on untrusted workbook content: key non-empty, status a known bucket. */
const rowSchema = z.object({
  key: z.string().min(1),
  source: z.string(),
  currentTarget: z.string(),
  status: z.enum(["new", "changed", "unchanged"]),
  sourceHash: z.string(),
  translation: z.string(),
  context: z.string(),
});

/** Coerce a cell value to a string, falling back to the cell's rendered text for object cells. */
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
 * Read one worksheet row into a {@link WorkbookRow}, validated by the zod row schema at this
 * untrusted boundary.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the row has no key or an unrecognized status
 */
function parseRow(sheet: ExcelJS.Worksheet, row: ExcelJS.Row): WorkbookRow {
  const candidate = {
    key: cellString(row.getCell(COLUMN.key)),
    source: cellString(row.getCell(COLUMN.source)),
    currentTarget: cellString(row.getCell(COLUMN.current)),
    status: cellString(row.getCell(COLUMN.status)) as RowStatus,
    sourceHash: cellString(row.getCell(COLUMN.sourceHash)),
    translation: cellString(row.getCell(COLUMN.translation)),
    // A workbook built before the Context column existed has no cell here; getCell auto-vivifies an
    // empty one, so cellString yields "" and the row still validates, keeping import backward-compatible.
    context: cellString(row.getCell(COLUMN.context)),
  };
  const result = rowSchema.safeParse(candidate);
  if (!result.success) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The sheet "${sheet.name}" has a row with a missing key or an unrecognized status.`,
    );
  }
  return result.data;
}

/**
 * Read one data sheet into a {@link WorkbookSheet}: verify the header, enforce the per-sheet and
 * per-row caps, skip blank rows, and parse the rest. The locale is taken from the sheet name.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` on a missing header, a cap breach, or a bad row
 */
function readDataSheet(sheet: ExcelJS.Worksheet, limits: WorkbookLimits): WorkbookSheet {
  assertHeader(sheet);
  if (sheet.rowCount - HEADER_ROW > limits.maxRowsPerSheet) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The sheet "${sheet.name}" has more than the maximum of ${limits.maxRowsPerSheet} rows.`,
    );
  }
  const rows: WorkbookRow[] = [];
  for (let rowNumber = HEADER_ROW + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount > limits.maxCellsPerRow) {
      throw new ExchangeError(
        "WORKBOOK_INVALID",
        `The sheet "${sheet.name}" has a row with more than the maximum of ${limits.maxCellsPerRow} cells.`,
      );
    }
    // A wholly blank row (no key) is skipped: translators sometimes leave trailing blanks.
    if (cellString(row.getCell(COLUMN.key)) === "") {
      continue;
    }
    rows.push(parseRow(sheet, row));
  }
  // The locale round-trips through the worksheet name: set to the locale on build and read back here.
  return { locale: sheet.name, rows };
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
    // exceljs expects a Node Buffer; wrap the bytes in a Buffer view (no copy).
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
 * instructions sheet) is read with the per-sheet and per-row caps and a zod row-shape check. It
 * decides no policy: it returns rows for the SDK to judge. Every structural problem surfaces as a
 * structured {@link ExchangeError} (`WORKBOOK_INVALID`); no raw library throw, buffer, or path escapes.
 *
 * @param bytes - the returned workbook bytes (already on-disk size-capped by the SDK's read)
 * @param options - optional caps; defaults to {@link DEFAULT_WORKBOOK_LIMITS}
 * @returns the parsed sheets in workbook order
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
  for (const sheet of workbook.worksheets) {
    if (sheet.name === INSTRUCTIONS_SHEET_NAME) {
      continue;
    }
    sheets.push(readDataSheet(sheet, limits));
  }
  return { sheets };
}
