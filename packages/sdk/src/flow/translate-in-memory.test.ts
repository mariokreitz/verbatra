import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BoundedBytesRead, BoundedFileRead, SdkFs } from "../fs.js";
import { baseConfig, makeStubProvider, makeTempDir } from "../test-support.js";
import { translate } from "./translate-project.js";

interface MemorySdkFs {
  readonly fs: SdkFs;
  readonly files: Map<string, string>;
  readonly writes: string[];
}

function memorySdkFs(initial: Record<string, string>): MemorySdkFs {
  const files = new Map<string, string>(Object.entries(initial));
  const writes: string[] = [];
  const fs: SdkFs = {
    fileExists: async (path: string): Promise<boolean> => files.has(path),
    readFileBounded: async (path: string): Promise<BoundedFileRead> => {
      const content = files.get(path);
      return content === undefined ? { kind: "missing" } : { kind: "ok", content };
    },
    readBytesBounded: async (): Promise<BoundedBytesRead> => ({ kind: "missing" }),
    writeFile: async (path: string, data: string): Promise<void> => {
      writes.push(path);
      files.set(path, data);
    },
    writeBytes: async (): Promise<void> => {},
    createExclusive: async (path: string, data: string): Promise<boolean> => {
      if (files.has(path)) {
        return false;
      }
      writes.push(path);
      files.set(path, data);
      return true;
    },
    deleteFile: async (path: string): Promise<void> => {
      files.delete(path);
    },
  };
  return { fs, files, writes };
}

describe("translate with an injected deps.fs", () => {
  it("runs fully in memory: the locale files are read from and written to the port, not disk", async () => {
    const dir = await makeTempDir();
    const sourcePath = join(dir, "locales", "en.json");
    const targetPath = join(dir, "locales", "de.json");
    const before = await readdir(dir);

    const { fs, files, writes } = memorySdkFs({
      [sourcePath]: '{"greeting":"Hello","farewell":"Bye"}',
    });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: baseConfig({ targetLocales: ["de"] }), cwd: dir },
      { createProvider: () => stub.provider, fs },
    );

    expect(summary.succeeded).toEqual(["de"]);
    expect(JSON.parse(files.get(targetPath) ?? "null")).toEqual({
      greeting: "[de] Hello",
      farewell: "[de] Bye",
    });
    expect(writes).toContain(targetPath);
    expect(writes.some((path) => path.endsWith("verbatra.lock.json"))).toBe(true);

    const after = await readdir(dir);
    expect(after).toEqual(before);
    expect(after).toEqual([]);
  });

  it("reads the existing target from the port, so a key it already carries is left alone", async () => {
    const dir = await makeTempDir();
    const sourcePath = join(dir, "locales", "en.json");
    const targetPath = join(dir, "locales", "de.json");

    const { fs, files } = memorySdkFs({
      [sourcePath]: '{"greeting":"Hello"}',
      [targetPath]: '{"greeting":"Hallo"}',
    });
    const stub = makeStubProvider();

    await translate(
      { config: baseConfig({ targetLocales: ["de"] }), cwd: dir },
      { createProvider: () => stub.provider, fs },
    );

    expect(JSON.parse(files.get(targetPath) ?? "null")).toEqual({ greeting: "Hallo" });
    expect(stub.calls).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });
});
