import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultFs, tempFileName } from "./fs.js";
import { makeTempDir } from "./test-support.js";

describe("tempFileName", () => {
  it("is unique for the same target across calls in immediate succession (same ms, same pid)", () => {
    const path = "/proj/locales/de.json";
    const names = new Set([tempFileName(path), tempFileName(path), tempFileName(path)]);
    expect(names.size).toBe(3);
  });

  it("places the temp as a hidden sibling in the target's own directory", () => {
    const path = "/proj/locales/de.json";
    const name = tempFileName(path);
    expect(dirname(name)).toBe(dirname(path));
    expect(basename(name).startsWith(".de.json.tmp-")).toBe(true);
  });
});

describe("defaultFs binary read/write", () => {
  it("readBytesBounded returns bytes below the cap, too-large above it, missing when absent", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "blob.bin");
    const data = new Uint8Array([0, 1, 2, 3, 255]);
    await writeFile(path, data);

    expect(await defaultFs.readBytesBounded(path, 2)).toEqual({ kind: "too-large" });
    const ok = await defaultFs.readBytesBounded(path, 100);
    expect(ok.kind).toBe("ok");
    if (ok.kind === "ok") {
      expect([...ok.bytes]).toEqual([0, 1, 2, 3, 255]);
    }
    expect(await defaultFs.readBytesBounded(join(dir, "absent.bin"), 100)).toEqual({
      kind: "missing",
    });
  });

  it("readBytesBounded reports a directory path as missing (not a regular file)", async () => {
    const dir = await makeTempDir();
    expect(await defaultFs.readBytesBounded(dir, 100)).toEqual({ kind: "missing" });
  });

  it("writeBytes writes atomically and round-trips", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "out.bin");
    const data = new Uint8Array([9, 8, 7]);
    await defaultFs.writeBytes(path, data);
    expect([...(await readFile(path))]).toEqual([9, 8, 7]);
  });
});
