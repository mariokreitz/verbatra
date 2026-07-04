import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildWorkbook } from "./build-workbook.js";
import { ExchangeError } from "./errors.js";
import { COLUMN, HEADER_ROW, INSTRUCTIONS_SHEET_NAME } from "./layout.js";
import type { WorkbookModel } from "./types.js";

const model: WorkbookModel = {
  sheets: [
    {
      locale: "de",
      rows: [
        {
          key: "greeting",
          source: "Hello {name}",
          currentTarget: "Hallo",
          status: "changed",
          sourceHash: "abc123",
          translation: "",
        },
      ],
    },
  ],
};

/** Build the model and load it back with exceljs to inspect the styling exceljs preserves. */
async function loadBuilt(input: WorkbookModel = model): Promise<ExcelJS.Workbook> {
  const bytes = await buildWorkbook(input);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  return workbook;
}

describe("buildWorkbook: translator-facing properties", () => {
  it("includes an instructions sheet with the key guidance", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet(INSTRUCTIONS_SHEET_NAME);
    expect(sheet).toBeDefined();

    const lines: string[] = [];
    sheet?.eachRow((row) => {
      const value = row.getCell(1).value;
      lines.push(typeof value === "string" ? value : "");
    });
    const text = lines.join("\n");
    expect(text).toContain("Fill ONLY the 'Translation' column");
    expect(text).toContain("Leave every other column unchanged");
    expect(text).toContain("must stay verbatim");
    expect(text).toContain("keep the ICU");
  });

  it("freezes the data sheet header row", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    const view = sheet?.views[0];
    expect(view?.state).toBe("frozen");
    expect((view as { ySplit?: number } | undefined)?.ySplit).toBe(HEADER_ROW);
  });

  it("locks the read-only cells and leaves only the translation cell unlocked", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    // locked: true is exceljs's default and may be omitted from the serialized XML, so a reloaded
    // locked cell reads as { locked: true } or undefined; either way it is not explicitly unlocked.
    // The translation cell carries the non-default locked: false, which always round-trips, so it is
    // asserted strictly.
    const lockedColumns = [
      COLUMN.key,
      COLUMN.source,
      COLUMN.current,
      COLUMN.status,
      COLUMN.sourceHash,
    ];
    for (const column of lockedColumns) {
      expect(dataRow?.getCell(column).protection?.locked).not.toBe(false);
    }
    expect(dataRow?.getCell(COLUMN.translation).protection?.locked).toBe(false);
  });

  it("hides the source-hash column", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    expect(sheet?.getColumn(COLUMN.sourceHash).hidden).toBe(true);
  });

  it("applies the read-only fill to the locked columns, not the translation column", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    const keyFill = dataRow?.getCell(COLUMN.key).fill as ExcelJS.Fill | undefined;
    expect(keyFill?.type).toBe("pattern");
    if (keyFill?.type === "pattern") {
      expect(keyFill.fgColor?.argb).toBe("FFF1F3F5");
    }
    // The editable translation cell is not shaded with the read-only fill: exceljs materializes a
    // default unshaded fill (no fill, or the "none" pattern with no fgColor) for a styled cell, so
    // what matters is only that it is not the solid read-only shading the locked columns carry.
    const translationFill = dataRow?.getCell(COLUMN.translation).fill as ExcelJS.Fill | undefined;
    if (translationFill?.type === "pattern") {
      expect(translationFill.pattern).not.toBe("solid");
      expect(translationFill.fgColor?.argb).not.toBe("FFF1F3F5");
    }
  });
});

describe("buildWorkbook: translation column text format", () => {
  it("formats a filled translation cell as text so Excel cannot coerce typed input", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    expect(dataRow?.getCell(COLUMN.translation).numFmt).toBe("@");
  });

  it("formats an empty translation cell as text too", async () => {
    const empty: WorkbookModel = {
      sheets: [
        {
          locale: "de",
          rows: [
            {
              key: "greeting",
              source: "Hello",
              currentTarget: "",
              status: "new",
              sourceHash: "abc123",
              translation: "",
            },
          ],
        },
      ],
    };
    const workbook = await loadBuilt(empty);
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    expect(dataRow?.getCell(COLUMN.translation).numFmt).toBe("@");
  });

  it("does not format the other read-only columns as text", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    expect(dataRow?.getCell(COLUMN.key).numFmt).not.toBe("@");
    expect(dataRow?.getCell(COLUMN.source).numFmt).not.toBe("@");
  });

  it("also formats the translation column at the column level, beyond written rows", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    expect(sheet?.getColumn(COLUMN.translation).numFmt).toBe("@");
  });
});

describe("buildWorkbook: worksheet-name coupling guard", () => {
  it("rejects a locale longer than 31 characters", async () => {
    const bad: WorkbookModel = { sheets: [{ locale: "a".repeat(32), rows: [] }] };
    const error = await buildWorkbook(bad).catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
  });

  it("rejects a locale with a forbidden worksheet-name character", async () => {
    const bad: WorkbookModel = { sheets: [{ locale: "de/at", rows: [] }] };
    const error = await buildWorkbook(bad).catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
  });

  it("rejects an empty locale", async () => {
    const bad: WorkbookModel = { sheets: [{ locale: "", rows: [] }] };
    const error = await buildWorkbook(bad).catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
  });
});
