import type { AdapterFs, BoundedReadOutcome } from "./fs-port.js";

export interface MemoryAdapterFs extends AdapterFs {
  readonly files: Map<string, string>;
}

function enoent(path: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), {
    code: "ENOENT",
  });
}

export function createMemoryAdapterFs(initial: Record<string, string> = {}): MemoryAdapterFs {
  const files = new Map<string, string>(Object.entries(initial));
  return {
    files,
    async readBounded(path: string, maxBytes: number): Promise<BoundedReadOutcome> {
      const content = files.get(path);
      if (content === undefined) {
        throw enoent(path);
      }
      if (Buffer.byteLength(content, "utf8") > maxBytes) {
        return { kind: "too-large" };
      }
      return { kind: "ok", content };
    },
    async writeFileAtomic(path: string, data: string): Promise<void> {
      files.set(path, data);
    },
  };
}
