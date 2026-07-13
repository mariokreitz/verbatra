import ExcelJS from "exceljs";
import { ExchangeError } from "./errors.js";
import { INSTRUCTIONS_LINES } from "./instructions.js";
import { COLUMN, HEADER_ROW, HEADERS, INSTRUCTIONS_SHEET_NAME } from "./layout.js";
import type { WorkbookModel, WorkbookSheet } from "./types.js";

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

/**
 * The Excel "Text" number format. Applied to the translation cell so Excel treats whatever the
 * translator types as literal text instead of coercing it: a value like "007" or "1.10" would
 * otherwise lose its leading zero or trailing zero, "3/4" would parse as a date, a long numeric id
 * would lose precision or turn into scientific notation, and a value starting with "=", "+", "-", or
 * "@" would be parsed as a formula.
 */
const TEXT_NUMBER_FORMAT = "@";

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

function applyColumnGeometry(sheet: ExcelJS.Worksheet): void {
  for (const [column, width] of Object.entries(COLUMN_WIDTHS)) {
    sheet.getColumn(Number(column)).width = width;
  }
  // The source-hash column is provenance, not for the translator.
  sheet.getColumn(COLUMN.sourceHash).hidden = true;
  // Defense in depth alongside the per-cell numFmt in writeRow: any cell a translator reaches in this
  // column, including beyond the written rows, stays formatted as text.
  sheet.getColumn(COLUMN.translation).numFmt = TEXT_NUMBER_FORMAT;
  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];
}

function writeRow(sheet: ExcelJS.Worksheet, sheetRow: WorkbookSheet["rows"][number]): void {
  const row = sheet.addRow([]);
  row.getCell(COLUMN.key).value = sheetRow.key;
  row.getCell(COLUMN.source).value = sheetRow.source;
  row.getCell(COLUMN.current).value = sheetRow.currentTarget;
  row.getCell(COLUMN.status).value = sheetRow.status;
  const translationCell = row.getCell(COLUMN.translation);
  translationCell.numFmt = TEXT_NUMBER_FORMAT;
  translationCell.value = sheetRow.translation === "" ? null : sheetRow.translation;
  row.getCell(COLUMN.sourceHash).value = sheetRow.sourceHash;

  // COLUMN holds literal indexes, so without widening the loop variable to `number` control flow
  // narrows it and TS reports the `!== COLUMN.translation` comparison as having no overlap (TS2367).
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
 * Excel's worksheet-name limits, which the locale round-trips through (the name is the data sheet's
 * name on build and the locale on read): max 31 characters and none of the characters : \ / ? * [ ].
 */
const MAX_WORKSHEET_NAME_LENGTH = 31;
const FORBIDDEN_WORKSHEET_NAME_CHARS = /[:\\/?*[\]]/;

/**
 * Reject a locale that cannot be a valid Excel worksheet name, since the locale round-trips through
 * the sheet name and Excel would otherwise truncate or reject it and break the round trip.
 *
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
 * Reject a sheet locale that would collide as an Excel worksheet name: exceljs deduplicates worksheet
 * names case-insensitively (in the `Worksheet` constructor, not in `Workbook.addWorksheet`), so two
 * target locales differing only in case, or a locale equal to the reserved instructions sheet name,
 * would otherwise reach `addWorksheet` and throw a raw, uncaught exceljs error. Checked once, up
 * front, for the whole model, so that error can never escape the package boundary.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if a locale collides with the reserved
 *   instructions sheet name, or with another sheet's locale
 */
function assertNoWorksheetNameCollisions(sheets: readonly WorkbookSheet[]): void {
  const reservedKey = INSTRUCTIONS_SHEET_NAME.toLowerCase();
  const seen = new Set<string>();
  for (const sheet of sheets) {
    const key = sheet.locale.toLowerCase();
    if (key === reservedKey) {
      throw new ExchangeError(
        "WORKBOOK_INVALID",
        `The locale "${sheet.locale}" cannot be an Excel worksheet name: it collides with the reserved "${INSTRUCTIONS_SHEET_NAME}" sheet.`,
      );
    }
    if (seen.has(key)) {
      throw new ExchangeError(
        "WORKBOOK_INVALID",
        `The locale "${sheet.locale}" cannot be an Excel worksheet name: it collides with another target locale's sheet name.`,
      );
    }
    seen.add(key);
  }
}

/**
 * Add one styled, protected data sheet for a locale: write the header and rows, apply the geometry,
 * and protect the sheet so only the translation column stays editable.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the locale is not a valid worksheet name
 */
async function buildDataSheet(workbook: ExcelJS.Workbook, sheet: WorkbookSheet): Promise<void> {
  assertValidWorksheetName(sheet.locale);
  const worksheet = workbook.addWorksheet(sheet.locale);
  styleHeader(worksheet);
  for (const row of sheet.rows) {
    writeRow(worksheet, row);
  }
  applyColumnGeometry(worksheet);
  // Empty password and spinCount 0: this is a soft guard, not access control, so skip the expensive
  // password hashing.
  await worksheet.protect("", {
    spinCount: 0,
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    sort: true,
    autoFilter: true,
  });
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
  sheet.getColumn(1).width = 110;
  for (const line of INSTRUCTIONS_LINES) {
    sheet.addRow([line]);
  }
  sheet.getRow(1).font = { bold: true };
}

/**
 * Build a styled `.xlsx` from the neutral row model: an instructions sheet first, then one data
 * sheet per target locale, each with a frozen header, shaded read-only columns, a hidden source-hash
 * column, and protection that leaves only the translation column editable. Output is deterministic
 * for a given model.
 *
 * @param model - the neutral workbook model (sheets in config order, rows in a stable order)
 * @returns the workbook bytes
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if a locale is not a valid worksheet name, collides
 *   with the reserved instructions sheet name, collides with another sheet's locale, or if exceljs
 *   fails to serialize the workbook
 */
export async function buildWorkbook(model: WorkbookModel): Promise<Uint8Array> {
  assertNoWorksheetNameCollisions(model.sheets);
  const workbook = new ExcelJS.Workbook();
  buildInstructionsSheet(workbook);
  for (const sheet of model.sheets) {
    await buildDataSheet(workbook, sheet);
  }
  try {
    // Copy the returned Node Buffer into a plain Uint8Array so no exceljs type leaks across the
    // package boundary.
    const buffer = await workbook.xlsx.writeBuffer();
    const view = buffer as unknown as Uint8Array;
    return Uint8Array.prototype.slice.call(view);
  } catch {
    throw new ExchangeError("WORKBOOK_INVALID", "The workbook could not be serialized.");
  }
}
