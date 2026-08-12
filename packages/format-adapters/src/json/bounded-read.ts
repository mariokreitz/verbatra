import { type FileHandle, open } from "node:fs/promises";
import { AdapterError } from "../errors.js";
import { MAX_INPUT_BYTES } from "./limits.js";

/** The result of a bounded read, with `not-a-file` and `too-large` left for callers to map to their own policy. */
export type BoundedReadOutcome =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "not-a-file" }
  | { readonly kind: "too-large" };

/** Strip exactly one leading UTF-8 byte-order-mark, if present. A bounded, fixed-length check, never a regex. */
function stripLeadingBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/** Read at most `size` bytes from the handle as UTF-8. The read never advances past `size`, so a file growing after it was sized stays bounded. */
async function readBoundedUtf8(handle: FileHandle, size: number): Promise<string> {
  const buffer = Buffer.allocUnsafe(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(buffer, offset, size - offset, offset);
    if (bytesRead === 0) {
      break;
    }
    offset += bytesRead;
  }
  return stripLeadingBom(buffer.toString("utf8", 0, offset));
}

/**
 * Read a file through a single handle so a path swap between the size check and the read cannot
 * bypass the size cap (a stat-then-read TOCTOU): the fstat and the bounded read share one inode.
 *
 * @param filePath - The file to read.
 * @returns A {@link BoundedReadOutcome}: `ok` with the content, `not-a-file`, or `too-large`.
 * @throws Rejects with the underlying filesystem error if the path cannot be opened. Raises no `AdapterError`.
 */
export async function readBounded(filePath: string): Promise<BoundedReadOutcome> {
  const handle = await open(filePath, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      return { kind: "not-a-file" };
    }
    if (info.size > MAX_INPUT_BYTES) {
      return { kind: "too-large" };
    }
    return { kind: "ok", content: await readBoundedUtf8(handle, info.size) };
  } finally {
    await handle.close();
  }
}

/**
 * Map a non-`ok` {@link BoundedReadOutcome} to its structured {@link AdapterError}, or return the
 * content unchanged for `ok`. `notAFileMessage` lets each call site phrase the not-a-regular-file
 * case for its own context (reading a source versus rewriting a destination); the too-large message
 * is fixed, since every caller reports the same size cap the same way.
 *
 * @throws {@link AdapterError} `INVALID_STRUCTURE` for `not-a-file`, or `INPUT_TOO_LARGE` for `too-large`.
 */
export function outcomeToContent(outcome: BoundedReadOutcome, notAFileMessage: string): string {
  if (outcome.kind === "not-a-file") {
    throw new AdapterError("INVALID_STRUCTURE", notAFileMessage);
  }
  if (outcome.kind === "too-large") {
    throw new AdapterError("INPUT_TOO_LARGE", "The file exceeds the maximum allowed size.");
  }
  return outcome.content;
}

/**
 * Run the bounded read and map its non-`ok` outcomes to structured {@link AdapterError}s. A missing or
 * unopenable path still rejects with the underlying filesystem error from {@link readBounded}.
 *
 * @param filePath - The file to read.
 * @returns The file content as UTF-8.
 * @throws {@link AdapterError} `INVALID_STRUCTURE` when the path is not a regular file, or
 *   `INPUT_TOO_LARGE` when it exceeds the size cap.
 */
export async function readFileContent(filePath: string): Promise<string> {
  const outcome = await readBounded(filePath);
  return outcomeToContent(outcome, "The path is not a regular file.");
}
