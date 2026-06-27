import { randomUUID } from "node:crypto";
import { access, type FileHandle, open, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** Outcome of a bounded read: the content, or why it could not be read in bounds. */
export type BoundedFileRead =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "missing" }
  | { readonly kind: "too-large" };

/** Outcome of a bounded binary read: the bytes, or why they could not be read in bounds. */
export type BoundedBytesRead =
  | { readonly kind: "ok"; readonly bytes: Uint8Array }
  | { readonly kind: "missing" }
  | { readonly kind: "too-large" };

/**
 * The minimal file-system surface the SDK needs. Reads are bounded and writes are atomic. Injectable so
 * tests stay deterministic; the format adapters do their own file IO and bypass this seam.
 */
export interface SdkFs {
  /** Whether a readable file exists at the path. */
  fileExists(path: string): Promise<boolean>;
  /**
   * Read a file as UTF-8 through a single handle, bounded to maxBytes. TOCTOU-safe: the handle is
   * fstat'd and the read never advances past the sized length, so swapping in a larger file cannot
   * bypass the cap. A missing or unreadable path is "missing"; a file over the cap is "too-large".
   */
  readFileBounded(path: string, maxBytes: number): Promise<BoundedFileRead>;
  /** Read a file as raw bytes with the same TOCTOU-safe, bounded discipline as {@link readFileBounded}. */
  readBytesBounded(path: string, maxBytes: number): Promise<BoundedBytesRead>;
  /** Write atomically: a temp file in the same directory, then rename over the target. */
  writeFile(path: string, data: string): Promise<void>;
  /** Write raw bytes atomically (temp file, then rename over the target). Used for the workbook. */
  writeBytes(path: string, data: Uint8Array): Promise<void>;
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
    // Missing or unreadable: treated as first-run.
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

async function readBoundedBytesInto(handle: FileHandle, size: number): Promise<Uint8Array> {
  // A non-pooled buffer so the returned view owns its memory and is never aliased by a later allocation.
  const buffer = Buffer.allocUnsafeSlow(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(buffer, offset, size - offset, offset);
    if (bytesRead === 0) {
      break;
    }
    offset += bytesRead;
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, offset);
}

async function readBoundedBytes(path: string, maxBytes: number): Promise<BoundedBytesRead> {
  let handle: FileHandle;
  try {
    handle = await open(path, "r");
  } catch {
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
    return { kind: "ok", bytes: await readBoundedBytesInto(handle, info.size) };
  } finally {
    await handle.close();
  }
}

/**
 * Build a collision-proof temp-file name for the atomic write: a hidden sibling of the target in the same
 * directory, carrying the pid, timestamp, and a random UUID so concurrent writes never collide.
 */
export function tempFileName(path: string): string {
  return join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`);
}

/**
 * Write to a temp file in the same directory, then rename over the target. rename is atomic on POSIX, so a
 * reader sees either the old or the new file, never a truncated middle.
 */
async function atomicWrite(path: string, data: string | Uint8Array): Promise<void> {
  const tmp = tempFileName(path);
  await (typeof data === "string" ? writeFile(tmp, data, "utf8") : writeFile(tmp, data));
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
  readBytesBounded: (path: string, maxBytes: number): Promise<BoundedBytesRead> =>
    readBoundedBytes(path, maxBytes),
  writeFile: (path: string, data: string): Promise<void> => atomicWrite(path, data),
  writeBytes: (path: string, data: Uint8Array): Promise<void> => atomicWrite(path, data),
};
