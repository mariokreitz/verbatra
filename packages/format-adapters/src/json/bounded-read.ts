import { type FileHandle, open } from "node:fs/promises";
import { AdapterError } from "../errors.js";
import { MAX_INPUT_BYTES } from "./limits.js";

/**
 * The result of a bounded read. `not-a-file` and `too-large` let callers pick their
 * own policy (the JSON adapter raises a structured error; the ngx-translate write path
 * silently defaults to nested) without re-checking on a second path resolution.
 */
export type BoundedReadOutcome =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "not-a-file" }
  | { readonly kind: "too-large" };

/**
 * Read at most `size` bytes from an already-open handle as UTF-8, looping over partial
 * reads and stopping at EOF. The read never advances past `size`, so even if the file
 * grows after it was sized the result stays bounded.
 */
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
 * Read a file through a single handle so a path swap between the size check and the
 * read cannot bypass the size cap (a stat-then-read TOCTOU). The handle is `fstat`'d
 * and the read is bounded to that size; both operate on the same inode, so replacing
 * the path with a larger file in the meantime has no effect.
 *
 * A missing path rejects (the underlying `open` throws); callers decide how to treat
 * that, matching the prior behavior where a missing file propagated from `stat`.
 *
 * @param filePath - The file to read.
 * @returns A {@link BoundedReadOutcome}: `ok` with the content, `not-a-file`, or `too-large`.
 * @throws Rejects with the underlying filesystem error if the path cannot be opened (for example, it
 *   does not exist). It raises no `AdapterError` of its own.
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
 * The shared read prelude every file adapter (tree and flat) uses: run the bounded read and
 * map its non-`ok` outcomes to structured {@link AdapterError}s, so the outcome switch lives in one
 * place instead of being duplicated per factory. `not-a-file` becomes `INVALID_STRUCTURE`,
 * `too-large` becomes `INPUT_TOO_LARGE`. A missing or unopenable path still rejects with the
 * underlying filesystem error (from {@link readBounded}), because there is no content to map.
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
