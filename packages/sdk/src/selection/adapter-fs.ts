import type { AdapterFs, BoundedReadOutcome } from "@verbatra/format-adapters";
import type { SdkFs } from "../fs.js";

function enoent(path: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), {
    code: "ENOENT",
  });
}

export function toAdapterFs(fs: SdkFs): AdapterFs {
  return {
    async readBounded(path: string, maxBytes: number): Promise<BoundedReadOutcome> {
      const outcome = await fs.readFileBounded(path, maxBytes);
      if (outcome.kind === "missing") {
        throw enoent(path);
      }
      if (outcome.kind === "too-large") {
        return { kind: "too-large" };
      }
      return { kind: "ok", content: outcome.content };
    },
  };
}
