import ExcelJS from "exceljs";
import { ExchangeError } from "./errors.js";
import { INSTRUCTIONS_LINES } from "./instructions.js";
import { COLUMN, HEADER_ROW, HEADERS, INSTRUCTIONS_SHEET_NAME } from "./layout.js";
import type { WorkbookModel, WorkbookSheet } from "./types.js";

// exceljs is imported here and in read-workbook.ts only; no other module touches it.

const READ_ONLY_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F3F5" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFDDE3EA" },
};

const COLUMN_WIDTHS: Readonly<Record<number, number>> = {
  [COLUMN.key]: 36,
  [COLUMN.source]: 50,
  [COLUMN.current]: 50,
  [COLUMN.status]: 12,
  [COLUMN.translation]: 50,
};

/** Write the header labels into the header row in bold with the header fill. */
function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(HEADER_ROW);
  HEADERS.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  header.commit();
}

/** Set the column widths, hide the source-hash column, and freeze the header row. */
function applyColumnGeometry(sheet: ExcelJS.Worksheet): void {
  for (const [column, width] of Object.entries(COLUMN_WIDTHS)) {
    sheet.getColumn(Number(column)).width = width;
  }
  // The source-hash column is provenance, not for the translator: hide it.
  sheet.getColumn(COLUMN.sourceHash).hidden = true;
  // Freeze the header row so it stays visible while scrolling.
  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];
}

/**
 * Write one data row's cells, then lock every cell except the translation cell and shade the
 * locked (read-only) columns.
 */
function writeRow(sheet: ExcelJS.Worksheet, sheetRow: WorkbookSheet["rows"][number]): void {
  const row = sheet.addRow([]);
  row.getCell(COLUMN.key).value = sheetRow.key;
  row.getCell(COLUMN.source).value = sheetRow.source;
  row.getCell(COLUMN.current).value = sheetRow.currentTarget;
  row.getCell(COLUMN.status).value = sheetRow.status;
  row.getCell(COLUMN.translation).value = sheetRow.translation === "" ? null : sheetRow.translation;
  row.getCell(COLUMN.sourceHash).value = sheetRow.sourceHash;

  // Lock every cell, then unlock only the translation cell, and shade the read-only columns. The
  // loop variable is widened to `number`: COLUMN is a map of literal indexes, so without the
  // annotation control flow narrows `column` to the literal 1 and the `!== COLUMN.translation`
  // comparison is reported as having no overlap (TS2367). The comparison is intentional.
  for (let column: number = COLUMN.key; column <= COLUMN.sourceHash; column += 1) {
    const cell = row.getCell(column);
    cell.protection = { locked: column !== COLUMN.translation };
    if (column !== COLUMN.translation) {
      cell.fill = READ_ONLY_FILL;
    }
  }
  row.commit();
}

/**
 * The hard limits Excel imposes on a worksheet name, which the locale identity round-trips
 * through: the name is the data sheet's name on build and the locale on read. Excel caps a
 * worksheet name at 31 characters and forbids the characters : \ / ? * [ ]. A configured locale
 * that cannot be a valid worksheet name would be silently truncated or rejected by Excel, breaking
 * the round trip, so we fail loudly here instead. Keep this coupling in mind when changing how the
 * locale maps to a sheet name in this module and the reader.
 */
const MAX_WORKSHEET_NAME_LENGTH = 31;
const FORBIDDEN_WORKSHEET_NAME_CHARS = /[:\\/?*[\]]/;

/**
 * Reject a locale that cannot be a valid Excel worksheet name (the locale round-trips through the
 * sheet name), guarding the 1-to-31-character bound and the forbidden characters `: \ / ? * [ ]`.
 *
 * @param locale - the target locale that will name the data sheet
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the locale is not a valid worksheet name
 */
function assertValidWorksheetName(locale: string): void {
  if (locale.length === 0 || locale.length > MAX_WORKSHEET_NAME_LENGTH) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The locale "${locale}" cannot be an Excel worksheet name: it must be 1 to ${MAX_WORKSHEET_NAME_LENGTH} characters.`,
    );
  }
  if (FORBIDDEN_WORKSHEET_NAME_CHARS.test(locale)) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The locale "${locale}" cannot be an Excel worksheet name: it must not contain any of : \\ / ? * [ ].`,
    );
  }
}

/**
 * Add one styled, protected data sheet for a locale: validate the sheet name, write the header and
 * rows, apply the geometry, and protect the sheet so only the translation column stays editable.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the locale is not a valid worksheet name
 */
async function buildDataSheet(workbook: ExcelJS.Workbook, sheet: WorkbookSheet): Promise<void> {
  // The locale round-trips through the worksheet name (named here, read back on import), so it must
  // be a valid Excel worksheet name or the round trip breaks; fail loudly rather than truncate.
  assertValidWorksheetName(sheet.locale);
  const worksheet = workbook.addWorksheet(sheet.locale);
  styleHeader(worksheet);
  for (const row of sheet.rows) {
    writeRow(worksheet, row);
  }
  applyColumnGeometry(worksheet);
  // Protect the sheet so the locked (read-only) cells cannot be edited; the translation column,
  // left unlocked above, stays editable. No password and spinCount 0: this is a soft guard, not
  // access control, and we skip the expensive password hashing. protect() is async; await it.
  await worksheet.protect("", {
    spinCount: 0,
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    sort: true,
    autoFilter: true,
  });
}

/** Add the leading instructions sheet that tells the translator which column to fill. */
function buildInstructionsSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
  sheet.getColumn(1).width = 110;
  for (const line of INSTRUCTIONS_LINES) {
    sheet.addRow([line]);
  }
  sheet.getRow(1).font = { bold: true };
}

/**
 * Build a styled `.xlsx` workbook from the neutral row model: an instructions sheet first, then
 * one data sheet per target locale, each with a frozen header, shaded read-only columns, a hidden
 * source-hash column, and sheet protection that leaves only the translation column editable. This
 * is the only place (with the reader) the xlsx library is used. It runs no check and touches no
 * locale or lock file. Output is deterministic for a given model (sheet and row order preserved).
 *
 * @param model - The neutral workbook model (sheets in config order, rows in a stable order).
 * @returns The workbook bytes.
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if exceljs fails to serialize the workbook.
 */
export async function buildWorkbook(model: WorkbookModel): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  buildInstructionsSheet(workbook);
  for (const sheet of model.sheets) {
    await buildDataSheet(workbook, sheet);
  }
  try {
    // exceljs returns a Node Buffer (a Uint8Array view); copy it into a plain Uint8Array so no
    // exceljs type leaks across the package boundary.
    const buffer = await workbook.xlsx.writeBuffer();
    const view = buffer as unknown as Uint8Array;
    return Uint8Array.prototype.slice.call(view);
  } catch {
    throw new ExchangeError("WORKBOOK_INVALID", "The workbook could not be serialized.");
  }
}
