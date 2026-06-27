import JSZip from "jszip";
import { ExchangeError } from "./errors.js";
import type { WorkbookLimits } from "./limits.js";

/**
 * Reject a workbook XML part that declares a DTD or entity, a defense-in-depth guard against XXE and
 * entity-expansion independent of the parser's defaults. Runs on every decompressed entry because
 * non-.xml markup parts (such as .vml) are also parsed; a well-formed xlsx declares neither.
 *
 * @param name - the workbook part name, used in the error message
 * @param xml - the decompressed part contents to scan
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if a DTD or entity is declared
 */
function assertNoDoctype(name: string, xml: string): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `A workbook XML part (${name}) declares a DTD or entity, which is not permitted.`,
    );
  }
}

/** The declared uncompressed size of a JSZip entry, or `undefined` when the metadata omits it. */
function declaredSize(file: JSZip.JSZipObject): number | undefined {
  const data = (file as { _data?: { uncompressedSize?: unknown } })._data;
  const size = data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : undefined;
}

/**
 * Bound an untrusted workbook before exceljs parses it: cap the entry count and the total
 * decompressed bytes, checked against both the declared sizes and the bytes actually produced so a
 * lying header cannot bypass the cap, and reject any DTD or entity ({@link assertNoDoctype}).
 *
 * @param bytes - the untrusted workbook bytes
 * @param limits - the caps to enforce
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` on an unreadable container or any cap breach
 */
export async function guardWorkbookBytes(bytes: Uint8Array, limits: WorkbookLimits): Promise<void> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ExchangeError("WORKBOOK_INVALID", "The workbook is not a readable xlsx container.");
  }

  const files = Object.values(zip.files).filter((file) => !file.dir);
  if (files.length > limits.maxEntryCount) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The workbook has more than the maximum of ${limits.maxEntryCount} entries.`,
    );
  }

  let declaredTotal = 0;
  for (const file of files) {
    const size = declaredSize(file);
    if (size !== undefined) {
      declaredTotal += size;
      if (declaredTotal > limits.maxDecompressedBytes) {
        throw new ExchangeError(
          "WORKBOOK_INVALID",
          `The workbook decompresses to more than the maximum of ${limits.maxDecompressedBytes} bytes.`,
        );
      }
    }
  }

  let actualTotal = 0;
  for (const file of files) {
    let content: string;
    try {
      content = await file.async("string");
    } catch {
      throw new ExchangeError("WORKBOOK_INVALID", "A workbook entry could not be decompressed.");
    }
    actualTotal += Buffer.byteLength(content, "utf8");
    if (actualTotal > limits.maxDecompressedBytes) {
      throw new ExchangeError(
        "WORKBOOK_INVALID",
        `The workbook decompresses to more than the maximum of ${limits.maxDecompressedBytes} bytes.`,
      );
    }
    assertNoDoctype(file.name, content);
  }
}
