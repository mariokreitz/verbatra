import { randomUUID } from "node:crypto";
import { access, type FileHandle, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export type BoundedFileRead =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "missing" }
  | { readonly kind: "too-large" };

export type BoundedBytesRead =
  | { readonly kind: "ok"; readonly bytes: Uint8Array }
  | { readonly kind: "missing" }
  | { readonly kind: "too-large" };

export interface SdkFs {
  fileExists(path: string): Promise<boolean>;
  readFileBounded(path: string, maxBytes: number): Promise<BoundedFileRead>;
  readBytesBounded(path: string, maxBytes: number): Promise<BoundedBytesRead>;
  writeFile(path: string, data: string): Promise<void>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  createExclusive(path: string, data: string): Promise<boolean>;
  deleteFile(path: string): Promise<void>;
  mkdir?(path: string): Promise<void>;
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

export function tempFileName(path: string): string {
  return join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`);
}

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

async function createExclusive(path: string, data: string): Promise<boolean> {
  await mkdir(dirname(path), { recursive: true });
  let handle: FileHandle;
  try {
    handle = await open(path, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw error;
  }
  try {
    await handle.writeFile(data, "utf8");
  } finally {
    await handle.close();
  }
  return true;
}

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
  createExclusive: (path: string, data: string): Promise<boolean> => createExclusive(path, data),
  deleteFile: async (path: string): Promise<void> => {
    await rm(path, { force: true });
  },
  mkdir: async (path: string): Promise<void> => {
    await mkdir(path, { recursive: true });
  },
};
