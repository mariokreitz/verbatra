import JSZip from "jszip";
import { ExchangeError } from "./errors.js";
import type { WorkbookLimits } from "./limits.js";

/**
 * Rejects a workbook XML part that declares a DTD or an entity, a defense-in-depth guard against
 * XXE and entity-expansion attacks independent of the XML parser's defaults. Runs on every
 * decompressed entry because several part types (including markup parts such as .vml) are parsed,
 * so a DOCTYPE or ENTITY in any of them must be caught before parsing. A well-formed xlsx contains
 * neither construct.
 *
 * @param name - the workbook part name, used in the error message
 * @param xml - the decompressed part contents to scan
 * @throws {@link ExchangeError} with code `WORKBOOK_INVALID` if a DTD or entity is declared
 */
function assertNoDoctype(name: string, xml: string): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `A workbook XML part (${name}) declares a DTD or entity, which is not permitted.`,
    );
  }
}

/**
 * The declared uncompressed size of a JSZip entry, read from the zip metadata when present.
 *
 * @param file - the JSZip entry to inspect
 * @returns the declared uncompressed byte count, or `undefined` when the metadata omits it
 */
function declaredSize(file: JSZip.JSZipObject): number | undefined {
  const data = (file as { _data?: { uncompressedSize?: unknown } })._data;
  const size = data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : undefined;
}

/**
 * Bound an untrusted workbook before exceljs parses it. The on-disk size is already capped by the
 * SDK's bounded read; this guard caps what the bytes expand into:
 *
 * - entry count (a zip with a huge central directory),
 * - total decompressed bytes, checked both against the declared sizes AND against the bytes
 *   actually produced as each entry is decompressed (so a lying header cannot bypass the cap),
 * - and, for every decompressed entry, the DTD/entity rejection ({@link assertNoDoctype}).
 *
 * Every breach raises a structured {@link ExchangeError} (`WORKBOOK_INVALID`); no raw library
 * throw, buffer, or path escapes. It returns nothing: the caller hands the same validated bytes
 * to exceljs only after this resolves.
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
