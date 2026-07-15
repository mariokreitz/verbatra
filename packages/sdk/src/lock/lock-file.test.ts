import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SdkError } from "../errors.js";
import { type BoundedFileRead, defaultFs, type SdkFs } from "../fs.js";
import { makeFakeFs, makeTempDir, readTextFile } from "../test-support.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockFileLocale,
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

  it("accepts a lock-file at the current version (regression guard)", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    await writeFile(path, JSON.stringify({ version: 1, locales: { de: { k: "v" } } }), "utf8");
    const lock = await readLockFile(path, defaultFs);
    expect(lock).toEqual({ version: 1, locales: { de: { k: "v" } } });
  });

  it("a lock-file from a newer, forward-incompatible version is LOCK_FILE_INVALID", async () => {
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    await writeFile(path, JSON.stringify({ version: 2, locales: {} }), "utf8");
    const error = await readLockFile(path, defaultFs).catch((e) => e);
    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("LOCK_FILE_INVALID");
    expect((error as SdkError).message).toContain("version 2");
  });

  it("a lock-file with version 0 is LOCK_FILE_INVALID (schema floor, not reachable version-check)", async () => {
    // CURRENT_VERSION = 1 and the schema requires a positive integer, so 1 is the lowest value
    // that can ever pass shape validation: a "version below CURRENT_VERSION" case is unreachable
    // today. This confirms version 0 is still rejected, via the pre-existing shape check; the
    // version-equality check below it is deliberately `!==`, not `>`, so it would also reject an
    // older version once CURRENT_VERSION is ever raised above 1.
    const dir = await makeTempDir();
    const path = join(dir, "verbatra.lock.json");
    await writeFile(path, JSON.stringify({ version: 0, locales: {} }), "utf8");
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

describe("updateLockFileLocale: replace mode", () => {
  it("replaces the locale's entire entries record, leaving other locales untouched", async () => {
    const dir = await makeTempDir();
    const path = lockFilePath(dir);
    await writeLockFile(
      path,
      { version: 1, locales: { de: { old: "h1" }, fr: { keep: "h2" } } },
      defaultFs,
    );

    const result = await updateLockFileLocale(dir, defaultFs, "de", {
      mode: "replace",
      entries: { fresh: "h3" },
    });

    expect(result.locales.de).toEqual({ fresh: "h3" });
    expect(result.locales.fr).toEqual({ keep: "h2" });
  });
});

describe("updateLockFileLocale: merge mode", () => {
  it("overlays only the given keys, leaving every other key in the locale untouched", async () => {
    const dir = await makeTempDir();
    const path = lockFilePath(dir);
    await writeLockFile(path, { version: 1, locales: { de: { a: "h1", b: "h2" } } }, defaultFs);

    const result = await updateLockFileLocale(dir, defaultFs, "de", {
      mode: "merge",
      entries: { a: "h1-new" },
    });

    expect(result.locales.de).toEqual({ a: "h1-new", b: "h2" });
  });

  it("performs exactly one read and one write, no internal retry loop", async () => {
    // updateLockFileLocale no longer guards its own concurrency (that is withLocaleWriteLock's
    // job): it is a plain read-modify-write, so it must touch the file system exactly once each way
    // regardless of what it reads.
    let reads = 0;
    const writes: string[] = [];
    const fs = makeFakeFs({
      readFileBounded: async (): Promise<BoundedFileRead> => {
        reads += 1;
        return { kind: "ok", content: `${JSON.stringify({ version: 1, locales: {} })}\n` };
      },
      writeFile: async (_path: string, data: string): Promise<void> => {
        writes.push(data);
      },
    });

    const result = await updateLockFileLocale("/anywhere", fs, "de", {
      mode: "merge",
      entries: { mine: "h" },
    });

    expect(result.locales.de).toEqual({ mine: "h" });
    expect(reads).toBe(1);
    expect(writes).toHaveLength(1);
  });
});

describe("updateLockFileLocale: the internal lock-file guard serializes concurrent different-locale writers", () => {
  it("never overlaps two read-modify-write steps, even across two different locales (regression guard for the shared lock-file race)", async () => {
    // withLocaleWriteLock only serializes writers for the SAME locale; two different locales are
    // allowed to run their own critical sections fully concurrently by design. Both still
    // read-modify-write the one shared lock-file, so without updateLockFileLocale's own internal
    // withLockFileGuard, this scenario loses one locale's update exactly like the old,
    // now-removed compare-and-swap was built to prevent (see lock-file-race.test.ts for the same
    // proof through real disk I/O and real timing).
    let content = `${JSON.stringify({ version: 1, locales: {} })}\n`;
    const held = new Set<string>();
    let insideCount = 0;
    let maxInsideCount = 0;

    const fs: SdkFs = {
      fileExists: async () => true,
      readFileBounded: async (): Promise<BoundedFileRead> => {
        insideCount += 1;
        maxInsideCount = Math.max(maxInsideCount, insideCount);
        // Forces the read-to-write span to be wide enough that, absent the guard, a concurrent
        // caller's own read would start while this one is still in flight.
        await new Promise((res) => setTimeout(res, 10));
        return { kind: "ok", content };
      },
      readBytesBounded: async () => ({ kind: "missing" }),
      writeFile: async (_path: string, data: string): Promise<void> => {
        content = data;
        insideCount -= 1;
      },
      writeBytes: async () => {},
      createExclusive: async (path: string): Promise<boolean> => {
        if (held.has(path)) {
          return false;
        }
        held.add(path);
        return true;
      },
      deleteFile: async (path: string): Promise<void> => {
        held.delete(path);
      },
    };

    await Promise.all([
      updateLockFileLocale("/proj", fs, "de", { mode: "merge", entries: { greeting: "hde" } }),
      updateLockFileLocale("/proj", fs, "fr", { mode: "merge", entries: { greeting: "hfr" } }),
    ]);

    expect(maxInsideCount).toBe(1);
    const final = JSON.parse(content) as { locales: Record<string, Record<string, string>> };
    expect(final.locales.de).toEqual({ greeting: "hde" });
    expect(final.locales.fr).toEqual({ greeting: "hfr" });
  });
});
