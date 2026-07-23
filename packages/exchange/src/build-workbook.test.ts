import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildWorkbook, spliceWorkbookProtection } from "./build-workbook.js";
import { ExchangeError } from "./errors.js";
import { COLUMN, HEADER_ROW, INSTRUCTIONS_SHEET_NAME } from "./layout.js";
import { readWorkbook } from "./read-workbook.js";
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
          context: "A friendly greeting shown on the home screen",
          reviewStatus: "ok",
          reviewReasons: "",
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
    const lockedColumns = [
      COLUMN.key,
      COLUMN.source,
      COLUMN.current,
      COLUMN.status,
      COLUMN.sourceHash,
      COLUMN.context,
      COLUMN.reviewStatus,
      COLUMN.reviewReasons,
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

  it("locks the workbook structure so tabs cannot be renamed, deleted, or reordered", async () => {
    const bytes = await buildWorkbook(model);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("xl/workbook.xml")?.async("string");
    expect(xml).toContain('<workbookProtection lockStructure="1"');
    expect(xml?.indexOf("workbookProtection")).toBeLessThan(xml?.indexOf("<sheets>") ?? -1);
  });

  it("stays readable after the structure lock is applied", async () => {
    const bytes = await buildWorkbook(model);
    const data = await readWorkbook(bytes);
    expect(data.sheets.map((s) => s.locale)).toEqual(["de"]);
    expect(data.sheets[0]?.rows[0]?.key).toBe("greeting");
  });

  it("splices workbookProtection before <sheets> when no <bookViews> is present", () => {
    const xml = "<workbook><workbookPr/><sheets><sheet/></sheets></workbook>";
    const spliced = spliceWorkbookProtection(xml);
    expect(spliced).toContain('<workbookProtection lockStructure="1" lockWindows="0"/><sheets>');
    expect(spliced.indexOf("workbookProtection")).toBeLessThan(spliced.indexOf("<sheets>"));
  });

  it("splices workbookProtection before <bookViews> to keep the CT_Workbook order", () => {
    const xml = "<workbook><workbookPr/><bookViews><workbookView/></bookViews><sheets/></workbook>";
    const spliced = spliceWorkbookProtection(xml);
    expect(spliced.indexOf("workbookProtection")).toBeLessThan(spliced.indexOf("<bookViews"));
    expect(spliced.indexOf("<bookViews")).toBeLessThan(spliced.indexOf("<sheets"));
  });

  it("writes the context column and keeps it visible, unlike the hidden source-hash column", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    expect(dataRow?.getCell(COLUMN.context).value).toBe(
      "A friendly greeting shown on the home screen",
    );
    expect(sheet?.getColumn(COLUMN.context).hidden).not.toBe(true);
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
    const translationFill = dataRow?.getCell(COLUMN.translation).fill as ExcelJS.Fill | undefined;
    if (translationFill?.type === "pattern") {
      expect(translationFill.pattern).not.toBe("solid");
      expect(translationFill.fgColor?.argb).not.toBe("FFF1F3F5");
    }
  });
});

describe("buildWorkbook: review columns", () => {
  const flagged: WorkbookModel = {
    sheets: [
      {
        locale: "de",
        rows: [
          {
            key: "greeting",
            source: "Hello {name}",
            currentTarget: "Hello {name}",
            status: "changed",
            sourceHash: "abc123",
            translation: "",
            context: "",
            reviewStatus: "review",
            reviewReasons: "length-ratio-outlier, equals-source",
          },
        ],
      },
    ],
  };

  it("writes reviewStatus and reviewReasons under the documented headers, in order", async () => {
    const workbook = await loadBuilt(flagged);
    const sheet = workbook.getWorksheet("de");
    const header = sheet?.getRow(HEADER_ROW);
    expect(header?.getCell(COLUMN.reviewStatus).value).toBe("Review status");
    expect(header?.getCell(COLUMN.reviewReasons).value).toBe("Review reasons");
    expect(COLUMN.reviewReasons).toBe(COLUMN.reviewStatus + 1);
  });

  it("writes the row's review status and reasons read-only", async () => {
    const workbook = await loadBuilt(flagged);
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    expect(dataRow?.getCell(COLUMN.reviewStatus).value).toBe("review");
    expect(dataRow?.getCell(COLUMN.reviewReasons).value).toBe(
      "length-ratio-outlier, equals-source",
    );
    expect(dataRow?.getCell(COLUMN.reviewStatus).protection?.locked).not.toBe(false);
    expect(dataRow?.getCell(COLUMN.reviewReasons).protection?.locked).not.toBe(false);
  });

  it("writes an ok review status with empty reasons for a clean row", async () => {
    const workbook = await loadBuilt();
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    expect(dataRow?.getCell(COLUMN.reviewStatus).value).toBe("ok");
    expect(dataRow?.getCell(COLUMN.reviewReasons).value).toBe("");
  });

  it("does not format the review columns as text, like the other read-only columns", async () => {
    const workbook = await loadBuilt(flagged);
    const sheet = workbook.getWorksheet("de");
    const dataRow = sheet?.getRow(HEADER_ROW + 1);
    expect(dataRow?.getCell(COLUMN.reviewStatus).numFmt).not.toBe("@");
    expect(dataRow?.getCell(COLUMN.reviewReasons).numFmt).not.toBe("@");
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
              context: "",
              reviewStatus: "ok",
              reviewReasons: "",
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

describe("buildWorkbook: worksheet-name collision guard", () => {
  it("rejects two target locales differing only in case", async () => {
    const bad: WorkbookModel = {
      sheets: [
        { locale: "de", rows: [] },
        { locale: "DE", rows: [] },
      ],
    };
    const error = await buildWorkbook(bad).catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
    expect((error as ExchangeError).message).toContain("DE");
  });

  it("rejects two identical target locales", async () => {
    const bad: WorkbookModel = {
      sheets: [
        { locale: "de", rows: [] },
        { locale: "de", rows: [] },
      ],
    };
    const error = await buildWorkbook(bad).catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
  });

  it.each([
    "Instructions",
    "instructions",
    "INSTRUCTIONS",
  ])("rejects a locale colliding with the reserved instructions sheet name (%s)", async (locale) => {
    const bad: WorkbookModel = { sheets: [{ locale, rows: [] }] };
    const error = await buildWorkbook(bad).catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
    expect((error as ExchangeError).message).toContain(locale);
  });

  it("never lets a raw exceljs error escape the package boundary on either collision path", async () => {
    const duplicateLocales: WorkbookModel = {
      sheets: [
        { locale: "de", rows: [] },
        { locale: "DE", rows: [] },
      ],
    };
    const reservedName: WorkbookModel = { sheets: [{ locale: "Instructions", rows: [] }] };

    const errors = await Promise.all([
      buildWorkbook(duplicateLocales).catch((e) => e),
      buildWorkbook(reservedName).catch((e) => e),
    ]);

    for (const error of errors) {
      expect(error).toBeInstanceOf(ExchangeError);
      expect((error as Error).message).not.toContain("Worksheet name already exists");
    }
  });

  it("builds successfully with distinct, non-colliding locales (no false positive)", async () => {
    const good: WorkbookModel = {
      sheets: [
        { locale: "de", rows: [] },
        { locale: "fr", rows: [] },
        { locale: "it-IT", rows: [] },
      ],
    };
    const bytes = await buildWorkbook(good);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
