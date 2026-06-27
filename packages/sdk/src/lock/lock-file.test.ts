import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SdkError } from "../errors.js";
import { type BoundedFileRead, defaultFs } from "../fs.js";
import { makeFakeFs, makeTempDir, readTextFile } from "../test-support.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockLocale,
  writeLockFile,
} from "./lock-file.js";

describe("lock-file", () => {
  it("a missing lock-file reads as an empty lock (first-run degradation)", async () => {
    const dir = await makeTempDir();
    const lock = await readLockFile(lockFilePath(dir), defaultFs);
    expect(lock).toEqual({ version: 1, locales: {} });
  });

  it("writes deterministically (sorted keys, trailing newline) and round-trips", async () => {
    const dir = await makeTempDir();
    const path = lockFilePath(dir);
    const lock = updateLockLocale({ version: 1, locales: {} }, "de", { b: "2", a: "1" });
    await writeLockFile(path, lock, defaultFs);
    const text = await readTextFile(path);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.indexOf('"a"')).toBeLessThan(text.indexOf('"b"'));
    const reread = await readLockFile(path, defaultFs);
    expect(reread.locales.de).toEqual({ a: "1", b: "2" });
  });

  it("a corrupt lock-file is a structured LOCK_FILE_INVALID", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    await writeFile(path, "{ not json", "utf8");
    const error = await readLockFile(path, defaultFs).catch((e) => e);
    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("LOCK_FILE_INVALID");
  });

  it("a wrongly-shaped lock-file is LOCK_FILE_INVALID", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    await writeFile(path, JSON.stringify({ version: 1, locales: { de: { k: 5 } } }), "utf8");
    await expect(readLockFile(path, defaultFs)).rejects.toMatchObject({
      code: "LOCK_FILE_INVALID",
    });
  });

  it("baselineFor returns the locale map, empty for an unknown locale", () => {
    const lock = { version: 1, locales: { de: { greeting: "abc" } } };
    expect(baselineFor(lock, "de").get("greeting")).toBe("abc");
    expect(baselineFor(lock, "fr").size).toBe(0);
  });

  it("readFileBounded reports too-large above the cap, ok below it, missing when absent", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    await writeFile(path, "hello world", "utf8"); // 11 bytes
    expect(await defaultFs.readFileBounded(path, 5)).toEqual({ kind: "too-large" });
    expect(await defaultFs.readFileBounded(path, 100)).toEqual({
      kind: "ok",
      content: "hello world",
    });
    expect(await defaultFs.readFileBounded(join(dir, "absent.json"), 100)).toEqual({
      kind: "missing",
    });
  });

  it("an over-cap lock-file is a structured LOCK_FILE_INVALID (bounded read)", async () => {
    const overCap = makeFakeFs({
      fileExists: async () => true,
      readFileBounded: async (): Promise<BoundedFileRead> => ({ kind: "too-large" }),
    });
    await expect(readLockFile("/anywhere/verbatra.lock.json", overCap)).rejects.toMatchObject({
      code: "LOCK_FILE_INVALID",
    });
  });

  it("writes atomically: overwrite leaves valid content and no leftover temp file", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    await writeLockFile(
      path,
      updateLockLocale({ version: 1, locales: {} }, "de", { a: "1" }),
      defaultFs,
    );
    await writeLockFile(
      path,
      updateLockLocale({ version: 1, locales: {} }, "de", { a: "2" }),
      defaultFs,
    );
    const reread = await readLockFile(path, defaultFs);
    expect(reread.locales.de).toEqual({ a: "2" });
    const entries = await readdir(dir);
    expect(entries).toEqual(["verbatra.lock.json"]);
  });

  it("a failed write leaves the prior lock-file intact", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    const good = updateLockLocale({ version: 1, locales: {} }, "de", { a: "1" });
    await writeLockFile(path, good, defaultFs);

    const throwingFs = makeFakeFs({
      fileExists: async () => true,
      writeFile: async () => {
        throw new Error("disk full");
      },
    });
    const next = updateLockLocale({ version: 1, locales: {} }, "de", { a: "2" });
    await expect(writeLockFile(path, next, throwingFs)).rejects.toThrow();

    const reread = await readLockFile(path, defaultFs);
    expect(reread.locales.de).toEqual({ a: "1" });
  });
});
