import { access, type FileHandle, open, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** Outcome of a bounded read: the content, or why it could not be read in bounds. */
export type BoundedFileRead =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "missing" }
  | { readonly kind: "too-large" };

/**
 * The minimal file-system surface the SDK needs for the lock-file and for existence
 * checks. Injectable so tests stay deterministic; the format adapters do their own
 * file IO and are not routed through this seam.
 */
export interface SdkFs {
  /** Whether a readable file exists at the path. */
  fileExists(path: string): Promise<boolean>;
  /**
   * Read a file as UTF-8 through a single handle, bounded to maxBytes. TOCTOU-safe: the
   * handle is fstat'd and the read never advances past the sized length, so swapping the
   * path for a larger file after the size check cannot bypass the cap. A missing or
   * unreadable path is "missing" (first-run); a file over the cap is "too-large".
   */
  readFileBounded(path: string, maxBytes: number): Promise<BoundedFileRead>;
  /** Write atomically: a temp file in the same directory, then rename over the target. */
  writeFile(path: string, data: string): Promise<void>;
}

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

async function readBounded(path: string, maxBytes: number): Promise<BoundedFileRead> {
  let handle: FileHandle;
  try {
    handle = await open(path, "r");
  } catch {
    // Missing or unreadable: treated as first-run, matching prior existence-check semantics.
    return { kind: "missing" };
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      return { kind: "missing" };
    }
    if (info.size > maxBytes) {
      return { kind: "too-large" };
    }
    return { kind: "ok", content: await readBoundedUtf8(handle, info.size) };
  } finally {
    await handle.close();
  }
}

/**
 * Write to a temp file in the same directory, then rename over the target. rename is
 * atomic on POSIX, so a reader sees either the old valid file or the new one, never a
 * truncated middle; a crash before the rename leaves the original untouched.
 */
async function atomicWrite(path: string, data: string): Promise<void> {
  const tmp = join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}`);
  await writeFile(tmp, data, "utf8");
  try {
    await rename(tmp, path);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

/** The production file system, backed by node:fs/promises. */
export const defaultFs: SdkFs = {
  async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  readFileBounded: (path: string, maxBytes: number): Promise<BoundedFileRead> =>
    readBounded(path, maxBytes),
  writeFile: (path: string, data: string): Promise<void> => atomicWrite(path, data),
};
