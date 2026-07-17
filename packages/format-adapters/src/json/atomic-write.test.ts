import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { LocaleResource } from "@verbatra/core";
import { describe, expect, it, vi } from "vitest";
import { AdapterError } from "../errors.js";
import { createI18nextJsonAdapter } from "../i18next/i18next-adapter.js";
import { type AtomicWriteOps, atomicWriteFile, tempFileName } from "./atomic-write.js";

const realOps: AtomicWriteOps = {
  writeFile: (path, data) => writeFile(path, data, "utf8"),
  fsyncFile: async () => {},
  rename: (from, to) => rename(from, to),
  fsyncDir: async () => {},
  rm: (path) => rm(path, { force: true }),
};

function makeDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "verbatra-aw-"));
}

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

describe("atomicWriteFile", () => {
  it("writes the exact bytes and creates the temp in the SAME directory as the target", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    let tempPath: string | undefined;
    const ops: AtomicWriteOps = {
      ...realOps,
      writeFile: (path, data) => {
        tempPath = path;
        return realOps.writeFile(path, data);
      },
    };

    await atomicWriteFile(target, "DATA\n", ops);

    expect(await readFile(target, "utf8")).toBe("DATA\n");
    expect(tempPath).toBeDefined();
    expect(dirname(tempPath as string)).toBe(dir);
    expect(await readdir(dir)).toEqual(["en.json"]);
  });

  it("default node ops write the file with no leftover temp", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    await atomicWriteFile(target, "EXACT\n");
    expect(await readFile(target, "utf8")).toBe("EXACT\n");
    expect(await readdir(dir)).toEqual(["en.json"]);
  });

  it("a rename failure leaves the prior target intact and cleans up the temp", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    await writeFile(target, "OLD\n", "utf8");
    const ops: AtomicWriteOps = {
      ...realOps,
      rename: async () => {
        throw new Error("RENAME_FAIL");
      },
    };
    await expect(atomicWriteFile(target, "NEW\n", ops)).rejects.toThrow("RENAME_FAIL");
    expect(await readFile(target, "utf8")).toBe("OLD\n");
    expect(await readdir(dir)).toEqual(["en.json"]);
  });

  it("a temp-write failure leaves the prior target intact and leaves no temp", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    await writeFile(target, "OLD\n", "utf8");
    const ops: AtomicWriteOps = {
      ...realOps,
      writeFile: async () => {
        throw new Error("WRITE_FAIL");
      },
    };
    await expect(atomicWriteFile(target, "NEW\n", ops)).rejects.toThrow("WRITE_FAIL");
    expect(await readFile(target, "utf8")).toBe("OLD\n");
    expect(await readdir(dir)).toEqual(["en.json"]);
  });

  it("cleanup never masks the original error: rename fails AND cleanup fails", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    const ops: AtomicWriteOps = {
      ...realOps,
      writeFile: (path, data) => realOps.writeFile(path, data),
      rename: async () => {
        throw new Error("RENAME_FAIL");
      },
      rm: async () => {
        throw new Error("CLEANUP_FAIL");
      },
    };
    let caught: unknown;
    try {
      await atomicWriteFile(target, "NEW\n", ops);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe("RENAME_FAIL");
    expect(caught).not.toBeInstanceOf(AdapterError);
  });

  it("cleanup never masks the original error: temp-write fails AND cleanup fails", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    const ops: AtomicWriteOps = {
      ...realOps,
      writeFile: async () => {
        throw new Error("WRITE_FAIL");
      },
      rename: (from, to) => realOps.rename(from, to),
      rm: async () => {
        throw new Error("CLEANUP_FAIL");
      },
    };
    let caught: unknown;
    try {
      await atomicWriteFile(target, "NEW\n", ops);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe("WRITE_FAIL");
    expect(caught).not.toBeInstanceOf(AdapterError);
  });

  it("default ops clean up the temp when the rename fails (target is a directory)", async () => {
    const dir = await makeDir();
    const target = join(dir, "subdir");
    await mkdir(target);
    await expect(atomicWriteFile(target, "X\n")).rejects.toThrow();
    const leftovers = (await readdir(dir)).filter((name) => name.startsWith("."));
    expect(leftovers).toEqual([]);
  });
});

describe("atomicWriteFile durability sequencing", () => {
  it("calls writeFile, fsyncFile, rename, fsyncDir in that exact order on the happy path", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    const calls: string[] = [];
    const ops: AtomicWriteOps = {
      writeFile: async (path, data) => {
        calls.push("writeFile");
        await realOps.writeFile(path, data);
      },
      fsyncFile: async (path) => {
        calls.push("fsyncFile");
        await realOps.fsyncFile(path);
      },
      rename: async (from, to) => {
        calls.push("rename");
        await realOps.rename(from, to);
      },
      fsyncDir: async (path) => {
        calls.push("fsyncDir");
        await realOps.fsyncDir(path);
      },
      rm: (path) => realOps.rm(path),
    };

    await atomicWriteFile(target, "DATA\n", ops);

    expect(calls).toEqual(["writeFile", "fsyncFile", "rename", "fsyncDir"]);
  });

  it("aborts before rename, cleans up the temp, and rethrows when fsyncFile rejects", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    await writeFile(target, "OLD\n", "utf8");
    const rename = vi.fn(realOps.rename);
    const ops: AtomicWriteOps = {
      ...realOps,
      fsyncFile: async () => {
        throw new Error("FSYNC_FILE_FAIL");
      },
      rename,
    };

    await expect(atomicWriteFile(target, "NEW\n", ops)).rejects.toThrow("FSYNC_FILE_FAIL");

    expect(rename).not.toHaveBeenCalled();
    expect(await readFile(target, "utf8")).toBe("OLD\n");
    expect(await readdir(dir)).toEqual(["en.json"]);
  });

  it("still resolves when fsyncDir rejects, since the rename already completed", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    const ops: AtomicWriteOps = {
      ...realOps,
      fsyncDir: async () => {
        throw new Error("FSYNC_DIR_FAIL");
      },
    };

    await expect(atomicWriteFile(target, "DATA\n", ops)).resolves.toBeUndefined();
    expect(await readFile(target, "utf8")).toBe("DATA\n");
  });
});

describe("atomic write integration (byte-identical adapter output)", () => {
  it("the i18next adapter writes byte-identical output through the atomic write", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    const adapter = createI18nextJsonAdapter();
    const resource: LocaleResource = {
      locale: "en",
      namespace: "en",
      format: "i18next-json",
      entries: new Map([
        [
          "greeting",
          { key: "greeting", namespace: "en", value: "Hi", placeholders: [], isPlural: false },
        ],
      ]),
    };

    await adapter.write(resource, target);

    expect(await readFile(target, "utf8")).toBe(`{\n  "greeting": "Hi"\n}\n`);
    expect(await readdir(dir)).toEqual(["en.json"]);
  });
});
