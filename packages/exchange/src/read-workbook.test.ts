import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildWorkbook } from "./build-workbook.js";
import { ExchangeError } from "./errors.js";
import { DEFAULT_WORKBOOK_LIMITS } from "./limits.js";
import { readWorkbook } from "./read-workbook.js";
import type { WorkbookModel } from "./types.js";

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
    // Row 3 is left entirely blank.
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
              // status is constrained to "new" | "changed" at the type level; force an invalid one.
              status: "weird" as "new",
              sourceHash: "h1",
              translation: "Hallo",
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

  it("trips the decompressed-bytes cap on the actual byte count when the declared total is under it", async () => {
    // A stored entry of raw 0xFF bytes: the declared uncompressed size is N, but decoding to a
    // string yields N U+FFFD replacement chars that re-encode to 3N UTF-8 bytes. With the cap set
    // between N and 3N, the declared-size loop passes and only the actual-byte loop trips - the
    // guard against a header that under-declares its decompressed size.
    const raw = new Uint8Array(1000).fill(0xff);
    const zip = new JSZip();
    zip.file("lying.bin", raw);
    // STORE keeps the declared uncompressed size honest (1000) so the declared loop stays under cap.
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: 2000 };
    expect(await code(readWorkbook(bytes, { limits }))).toBe("WORKBOOK_INVALID");
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
