import { type FileHandle, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { type AtomicWriteOps, atomicWriteFile } from "./json/atomic-write.js";

export type BoundedReadOutcome =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "not-a-file" }
  | { readonly kind: "too-large" };

export interface AdapterFs {
  readBounded(path: string, maxBytes: number): Promise<BoundedReadOutcome>;
  writeFileAtomic(path: string, data: string): Promise<void>;
}

async function readUtf8(handle: FileHandle, size: number): Promise<string> {
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

async function nodeReadBounded(path: string, maxBytes: number): Promise<BoundedReadOutcome> {
  const handle = await open(path, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      return { kind: "not-a-file" };
    }
    if (info.size > maxBytes) {
      return { kind: "too-large" };
    }
    return { kind: "ok", content: await readUtf8(handle, info.size) };
  } finally {
    await handle.close();
  }
}

async function fsyncPath(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncDirBestEffort(path: string): Promise<void> {
  try {
    await fsyncPath(path);
  } catch {}
}

export const nodeOps: AtomicWriteOps = {
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  writeFile: (path, data) => writeFile(path, data, "utf8"),
  fsyncFile: (path) => fsyncPath(path),
  rename: (from, to) => rename(from, to),
  fsyncDir: (path) => fsyncDirBestEffort(path),
  rm: (path) => rm(path, { force: true }),
};

export const nodeAdapterFs: AdapterFs = {
  readBounded: nodeReadBounded,
  writeFileAtomic: (path, data) => atomicWriteFile(path, data, nodeOps),
};
