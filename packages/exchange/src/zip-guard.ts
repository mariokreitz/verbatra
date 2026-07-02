import { Readable } from "node:stream";
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
export function declaredSize(file: JSZip.JSZipObject): number | undefined {
  const data = (file as { _data?: { uncompressedSize?: unknown } })._data;
  const size = data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : undefined;
}

/**
 * The minimal structural shape {@link streamEntryBounded} needs: a per-entry Node readable stream of
 * the decompressed bytes. A JSZip `JSZipObject` satisfies it, and a test stub can too.
 */
interface EntryStreamSource {
  nodeStream(type?: "nodebuffer"): NodeJS.ReadableStream;
}

/**
 * Decompress one zip entry through a streaming, memory-bounded sink and return its UTF-8 text. Each
 * chunk's raw byte length is summed as it arrives; the moment the running raw total exceeds
 * `remaining` (the cumulative decompressed budget left across all entries) the loop breaks, which
 * triggers the async iterator's implicit `return()`, destroys the underlying Readable, and stops
 * JSZip's inflate worker. Peak memory is therefore bounded to roughly `remaining` rather than the
 * full inflated payload, closing the zip-bomb OOM.
 *
 * JSZip's `nodeStream` returns a legacy readable-stream that does not implement
 * `Symbol.asyncIterator`, so it is adapted with an object-mode `Readable.wrap` before the
 * `for await` loop; wrapping preserves chunk identity (Buffer or string) and forwards the source's
 * error, and object mode keeps the wrap from re-encoding string chunks to buffers.
 *
 * @param file - the entry, exposing a nodebuffer readable stream of its decompressed bytes
 * @param remaining - the remaining cumulative decompressed-byte budget for this entry
 * @returns the entry decoded as a UTF-8 string
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the entry alone breaches the budget or the
 *   stream errors (a corrupt or undecompressable entry)
 */
export async function streamEntryBounded(
  file: EntryStreamSource,
  remaining: number,
): Promise<string> {
  const chunks: Buffer[] = [];
  let raw = 0;
  let oversize = false;
  const source: NodeJS.ReadableStream = new Readable({ objectMode: true }).wrap(
    file.nodeStream("nodebuffer"),
  );
  try {
    for await (const chunk of source) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      raw += buf.length;
      if (raw > remaining) {
        oversize = true;
        break;
      }
      chunks.push(buf);
    }
  } catch {
    throw new ExchangeError("WORKBOOK_INVALID", "A workbook entry could not be decompressed.");
  }
  if (oversize) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      "The workbook decompresses to more than the permitted maximum bytes.",
    );
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Bound an untrusted workbook before exceljs parses it: cap the entry count and the total
 * decompressed bytes, checked against both the declared sizes and the bytes actually produced so a
 * lying header cannot bypass the cap, and reject any DTD or entity ({@link assertNoDoctype}). The
 * actual-bytes pass streams each entry ({@link streamEntryBounded}) so a high-ratio bomb is torn
 * down at roughly the cap instead of being fully inflated into memory.
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
    const remaining = limits.maxDecompressedBytes - actualTotal;
    const content = await streamEntryBounded(file, remaining);
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
