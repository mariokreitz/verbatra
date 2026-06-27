import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildWorkbook } from "./build-workbook.js";
import { ExchangeError } from "./errors.js";
import { DEFAULT_WORKBOOK_LIMITS } from "./limits.js";
import type { WorkbookModel } from "./types.js";
import { guardWorkbookBytes } from "./zip-guard.js";

const model: WorkbookModel = {
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

/**
 * Run the guard and return whatever it rejects with, failing the test if it resolves. Every
 * assertion below checks the rejection is a structured ExchangeError, never a raw JSZip throw.
 */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected guardWorkbookBytes to reject");
    },
    (error: unknown) => error,
  );
}

/** Assert the value is the structured exchange error with the WORKBOOK_INVALID code. */
function expectWorkbookInvalid(error: unknown): void {
  expect(error).toBeInstanceOf(ExchangeError);
  expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
}

describe("guardWorkbookBytes: reject matrix", () => {
  it("rejects a container whose entry count exceeds maxEntryCount", async () => {
    const zip = new JSZip();
    for (let index = 0; index < 10; index += 1) {
      zip.file(`file${index}.txt`, "x");
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxEntryCount: 3 };
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, limits)));
  });

  it("rejects in the declared-size pass when the summed declared sizes exceed the cap", async () => {
    // A single honest entry whose declared uncompressed size already exceeds the cap, so the
    // declared-size loop trips before any decompression happens.
    const zip = new JSZip();
    zip.file("big.txt", "A".repeat(5000));
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: 1000 };
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, limits)));
  });

  it("rejects in the actual-bytes pass on a lying header whose declared total stays under the cap", async () => {
    // A stored entry of raw 0xFF bytes: the declared uncompressed size is 1000, but decoding to a
    // string yields 1000 U+FFFD replacement chars that re-encode to 3000 UTF-8 bytes. With the cap
    // at 2000 the declared loop passes (1000 <= 2000) and only the actual-byte loop trips, proving
    // a header that under-declares its decompressed size cannot bypass the cap.
    const raw = new Uint8Array(1000).fill(0xff);
    const zip = new JSZip();
    zip.file("lying.bin", raw);
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: 2000 };
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, limits)));
  });

  it("rejects a part that declares a DTD via DOCTYPE", async () => {
    const zip = new JSZip();
    zip.file("doctype.xml", '<?xml version="1.0"?><!DOCTYPE root><root></root>');
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)));
  });

  it("rejects a part that declares an entity (XXE defense)", async () => {
    const zip = new JSZip();
    zip.file("entity.xml", '<?xml version="1.0"?><!ENTITY x "y">');
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)));
  });

  it("rejects bytes that are not a loadable zip container", async () => {
    const bytes = new TextEncoder().encode("this is not a zip container at all");
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)));
  });
});

describe("guardWorkbookBytes: accept", () => {
  it("resolves for a well-formed workbook within all caps and free of any DTD or entity", async () => {
    const bytes = await buildWorkbook(model);
    await expect(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)).resolves.toBeUndefined();
  });
});
