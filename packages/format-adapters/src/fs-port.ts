import { type FileHandle, open } from "node:fs/promises";

export type BoundedReadOutcome =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "not-a-file" }
  | { readonly kind: "too-large" };

export interface AdapterFs {
  readBounded(path: string, maxBytes: number): Promise<BoundedReadOutcome>;
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

export const nodeAdapterFs: AdapterFs = {
  readBounded: nodeReadBounded,
};
