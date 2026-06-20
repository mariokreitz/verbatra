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
    // locked: true is exceljs's cell default, which it may omit from the serialized XML; a reloaded
    // locked cell is therefore either { locked: true } or undefined (default-locked). Either way it
    // is NOT explicitly unlocked. The translation cell carries the non-default locked: false, which
    // exceljs always serializes and reads back exactly, so it is asserted strictly.
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
    // Only the translation cell carries the non-default locked: false; every other column,
    // including the hidden source-hash column, stays locked.
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
    // The editable translation cell is not shaded with the read-only fill. It carries a protection
    // style (locked: false), and exceljs materializes a default unshaded fill for any styled cell:
    // either no fill, or the "none" pattern with no fgColor. What matters is that it is NOT the
    // solid read-only shading the locked columns carry, so the translation column reads as the
    // visibly blank one to fill.
    const translationFill = dataRow?.getCell(COLUMN.translation).fill as ExcelJS.Fill | undefined;
    if (translationFill?.type === "pattern") {
      expect(translationFill.pattern).not.toBe("solid");
      expect(translationFill.fgColor?.argb).not.toBe("FFF1F3F5");
    }
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
