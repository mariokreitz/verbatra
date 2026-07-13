import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildWorkbook } from "./build-workbook.js";
import { ExchangeError } from "./errors.js";
import { DEFAULT_WORKBOOK_LIMITS } from "./limits.js";
import { readWorkbook } from "./read-workbook.js";
import type { WorkbookModel } from "./types.js";
import { declaredSize } from "./zip-guard.js";

const baseModel: WorkbookModel = {
  sheets: [
    {
      locale: "de",
      rows: [
        {
          key: "k1",
          source: "Hello",
          currentTarget: "",
          status: "new",
          sourceHash: "h1",
          translation: "",
          context: "A greeting",
        },
      ],
    },
  ],
};

async function code(promise: Promise<unknown>): Promise<string | undefined> {
  const error = await promise.catch((e) => e);
  return error instanceof ExchangeError ? error.code : undefined;
}

describe("readWorkbook: structural rejection", () => {
  it("reads a valid workbook", async () => {
    const data = await buildWorkbook(baseModel);
    expect((await readWorkbook(data)).sheets[0]?.rows[0]?.key).toBe("k1");
  });

  it("reads the context column back verbatim", async () => {
    const data = await buildWorkbook(baseModel);
    expect((await readWorkbook(data)).sheets[0]?.rows[0]?.context).toBe("A greeting");
  });

  it("reads a pre-change workbook with no Context column as an empty context, not a rejection", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("de");
    ["Key", "Source", "Current translation", "Status", "Translation", "Source hash"].forEach(
      (label, index) => {
        sheet.getRow(1).getCell(index + 1).value = label;
      },
    );
    sheet.getRow(2).getCell(1).value = "k1";
    sheet.getRow(2).getCell(4).value = "new";
    const buffer = await workbook.xlsx.writeBuffer();
    const data = await readWorkbook(new Uint8Array(buffer as ArrayBuffer));
    expect(data.sheets[0]?.rows[0]?.context).toBe("");
  });

  it("rejects a data sheet missing the Key/Source-hash header", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("de");
    sheet.getRow(1).getCell(1).value = "NotKey";
    sheet.getRow(2).getCell(1).value = "k1";
    const buffer = await workbook.xlsx.writeBuffer();
    expect(await code(readWorkbook(new Uint8Array(buffer as ArrayBuffer)))).toBe(
      "WORKBOOK_INVALID",
    );
  });

  it("coerces non-string cell values (numbers) to strings on read", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("de");
    ["Key", "Source", "Current translation", "Status", "Translation", "Source hash"].forEach(
      (label, index) => {
        sheet.getRow(1).getCell(index + 1).value = label;
      },
    );
    // A numeric key and a numeric source-hash exercise the number coercion branch.
    sheet.getRow(2).getCell(1).value = 42;
    sheet.getRow(2).getCell(4).value = "new";
    sheet.getRow(2).getCell(6).value = 123;
    const buffer = await workbook.xlsx.writeBuffer();
    const data = await readWorkbook(new Uint8Array(buffer as ArrayBuffer));
    expect(data.sheets[0]?.rows[0]?.key).toBe("42");
    expect(data.sheets[0]?.rows[0]?.sourceHash).toBe("123");
  });

  it("skips wholly blank trailing rows (no key) without error", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("de");
    ["Key", "Source", "Current translation", "Status", "Translation", "Source hash"].forEach(
      (label, index) => {
        sheet.getRow(1).getCell(index + 1).value = label;
      },
    );
    sheet.getRow(2).getCell(1).value = "k1";
    sheet.getRow(2).getCell(4).value = "new";
    sheet.getRow(4).getCell(1).value = "k2";
    sheet.getRow(4).getCell(4).value = "new";
    const buffer = await workbook.xlsx.writeBuffer();
    const data = await readWorkbook(new Uint8Array(buffer as ArrayBuffer));
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["k1", "k2"]);
  });

  it("coerces a rich-text (object) cell to its rendered text on read", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("de");
    ["Key", "Source", "Current translation", "Status", "Translation", "Source hash"].forEach(
      (label, index) => {
        sheet.getRow(1).getCell(index + 1).value = label;
      },
    );
    // A rich-text object cell exercises the object branch of cellString (the `.text` fallback).
    sheet.getRow(2).getCell(1).value = { richText: [{ text: "k" }, { text: "1" }] };
    sheet.getRow(2).getCell(4).value = "new";
    const buffer = await workbook.xlsx.writeBuffer();
    const data = await readWorkbook(new Uint8Array(buffer as ArrayBuffer));
    expect(data.sheets[0]?.rows[0]?.key).toBe("k1");
  });

  it("rejects a valid zip whose workbook part exceljs cannot parse", async () => {
    // Start from a real workbook (so the zip is structurally an xlsx and passes the byte guard),
    // then corrupt xl/workbook.xml to malformed XML. exceljs's load throws on the broken part, and
    // loadWorkbook must map it to a structured WORKBOOK_INVALID, not let a raw library throw escape.
    const valid = await buildWorkbook(baseModel);
    const zip = await JSZip.loadAsync(valid);
    zip.file("xl/workbook.xml", "<workbook><<<not valid xml");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expect(await code(readWorkbook(bytes))).toBe("WORKBOOK_INVALID");
  });

  it("accepts a row with status 'unchanged'", async () => {
    const withUnchanged: WorkbookModel = {
      sheets: [
        {
          locale: "de",
          rows: [
            {
              key: "k1",
              source: "Hello",
              currentTarget: "Hallo",
              status: "unchanged",
              sourceHash: "h1",
              translation: "",
              context: "",
            },
          ],
        },
      ],
    };
    const data = await readWorkbook(await buildWorkbook(withUnchanged));
    expect(data.sheets[0]?.rows[0]?.status).toBe("unchanged");
  });

  it("rejects a row with an unrecognized status via the zod row check", async () => {
    const bad: WorkbookModel = {
      sheets: [
        {
          locale: "de",
          rows: [
            {
              key: "k1",
              source: "Hello",
              currentTarget: "",
              // status is constrained to a known RowStatus at the type level; force an invalid one.
              status: "weird" as "new",
              sourceHash: "h1",
              translation: "Hallo",
              context: "",
            },
          ],
        },
      ],
    };
    expect(await code(readWorkbook(await buildWorkbook(bad)))).toBe("WORKBOOK_INVALID");
  });
});

describe("readWorkbook: parse-bound caps", () => {
  it("trips the sheet-count cap", async () => {
    const many: WorkbookModel = {
      sheets: [
        { locale: "de", rows: [] },
        { locale: "fr", rows: [] },
        { locale: "es", rows: [] },
      ],
    };
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxSheetCount: 2 };
    expect(await code(readWorkbook(await buildWorkbook(many), { limits }))).toBe(
      "WORKBOOK_INVALID",
    );
  });

  it("trips the rows-per-sheet cap", async () => {
    const rows = Array.from({ length: 5 }, (_unused, index) => ({
      key: `k${index}`,
      source: "s",
      currentTarget: "",
      status: "new" as const,
      sourceHash: "h",
      translation: "",
      context: "",
    }));
    const model: WorkbookModel = { sheets: [{ locale: "de", rows }] };
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxRowsPerSheet: 2 };
    expect(await code(readWorkbook(await buildWorkbook(model), { limits }))).toBe(
      "WORKBOOK_INVALID",
    );
  });

  it("trips the cells-per-row cap on a wide forged row", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("de");
    ["Key", "Source", "Current translation", "Status", "Translation", "Source hash"].forEach(
      (label, index) => {
        sheet.getRow(1).getCell(index + 1).value = label;
      },
    );
    sheet.getRow(2).getCell(1).value = "k1";
    sheet.getRow(2).getCell(4).value = "new";
    // Pad the row out to 40 cells to exceed a small cap.
    for (let column = 7; column <= 40; column += 1) {
      sheet.getRow(2).getCell(column).value = "x";
    }
    const bytes = new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxCellsPerRow: 10 };
    expect(await code(readWorkbook(bytes, { limits }))).toBe("WORKBOOK_INVALID");
  });

  it("trips the entry-count cap on a crafted zip", async () => {
    const zip = new JSZip();
    for (let index = 0; index < 10; index += 1) {
      zip.file(`file${index}.txt`, "x");
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxEntryCount: 3 };
    expect(await code(readWorkbook(bytes, { limits }))).toBe("WORKBOOK_INVALID");
  });

  it("trips the decompressed-bytes cap on a crafted highly-compressible zip", async () => {
    const zip = new JSZip();
    // A small zip that inflates far beyond the cap: 2 MiB of a single repeated byte.
    zip.file("big.txt", "A".repeat(2 * 1024 * 1024));
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    expect(bytes.byteLength).toBeLessThan(64 * 1024);
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: 1024 };
    expect(await code(readWorkbook(bytes, { limits }))).toBe("WORKBOOK_INVALID");
  });

  it("accepts a binary part whose raw bytes are under the actual-bytes cap even though UTF-8 decoding would inflate its byte count past it", async () => {
    // A well-formed workbook plus an added binary part (docProps/thumbnail.jpeg, the kind of part a
    // real .xlsx carries) of 1000 raw, non-UTF-8 bytes. Decoding that part lossily replaces every
    // invalid byte with U+FFFD (3 bytes in UTF-8), so re-encoding the decoded string would overcount
    // it by roughly 3x (2000 extra bytes here). The actual-bytes pass must sum true raw decompressed
    // bytes, not the re-encoded UTF-8 length, so this must be accepted.
    const thumbnailRaw = new Uint8Array(1000).fill(0xff);
    const zip = await JSZip.loadAsync(await buildWorkbook(baseModel));
    zip.file("docProps/thumbnail.jpeg", thumbnailRaw, { compression: "STORE" });
    const bytes = await zip.generateAsync({ type: "uint8array" });

    // The cap is derived from the true raw decompressed total (every entry's declared size, honest
    // for both the workbook's own parts and the stored thumbnail) rather than a hardcoded number, so
    // the test does not depend on buildWorkbook's exact byte output. Setting the cap 1000 bytes above
    // that true total sits strictly between the correct total and the re-encoded, 3x-inflated one
    // (true total + 2000), so only a comparison against the true raw total accepts this workbook.
    const loaded = await JSZip.loadAsync(bytes);
    const trueRawTotal = Object.values(loaded.files)
      .filter((file) => !file.dir)
      .reduce((sum, file) => sum + (declaredSize(file) ?? 0), 0);
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: trueRawTotal + 1000 };
    expect(await code(readWorkbook(bytes, { limits }))).toBeUndefined();
  });

  it("trips the DTD/entity guard on a crafted xlsx-like zip", async () => {
    const zip = new JSZip();
    zip.file("evil.xml", '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY x "y">]><root>&x;</root>');
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expect(await code(readWorkbook(bytes))).toBe("WORKBOOK_INVALID");
  });

  it("trips the DTD/entity guard on a non-.xml part (.vml)", async () => {
    // A DOCTYPE/ENTITY smuggled into a .vml part (which exceljs may parse as markup) must not
    // bypass the explicit guard. The scan runs on every decompressed entry, not only .xml.
    const zip = new JSZip();
    zip.file(
      "xl/drawings/vmlDrawing1.vml",
      '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY x "y">]><root>&x;</root>',
    );
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expect(await code(readWorkbook(bytes))).toBe("WORKBOOK_INVALID");
  });
});
