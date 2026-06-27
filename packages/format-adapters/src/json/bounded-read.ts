import { type FileHandle, open } from "node:fs/promises";
import { AdapterError } from "../errors.js";
import { MAX_INPUT_BYTES } from "./limits.js";

/** The result of a bounded read, with `not-a-file` and `too-large` left for callers to map to their own policy. */
export type BoundedReadOutcome =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "not-a-file" }
  | { readonly kind: "too-large" };

// The read never advances past `size`, so a file growing after it was sized stays bounded.
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
  return buffer.toString("utf8", 0, offset);
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
  if (outcome.kind === "not-a-file") {
    throw new AdapterError("INVALID_STRUCTURE", "The path is not a regular file.");
  }
  if (outcome.kind === "too-large") {
    throw new AdapterError("INPUT_TOO_LARGE", "The file exceeds the maximum allowed size.");
  }
  return outcome.content;
}
