import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { LocaleResource } from "@verbatra/core";
import { describe, expect, it, vi } from "vitest";
import { AdapterError } from "../errors.js";
import { createI18nextJsonAdapter } from "../i18next/i18next-adapter.js";
import { type AtomicWriteOps, atomicWriteFile, tempFileName } from "./atomic-write.js";

const realOps: AtomicWriteOps = {
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
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
  it("calls mkdir, writeFile, fsyncFile, rename, fsyncDir in that exact order on the happy path", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    const calls: string[] = [];
    const ops: AtomicWriteOps = {
      mkdir: async (path) => {
        calls.push("mkdir");
        await realOps.mkdir(path);
      },
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

    expect(calls).toEqual(["mkdir", "writeFile", "fsyncFile", "rename", "fsyncDir"]);
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

describe("atomicWriteFile: the target directory", () => {
  it("creates a missing parent directory rather than failing", async () => {
    const dir = await makeDir();
    const target = join(dir, "de", "common.json");

    await atomicWriteFile(target, "DATA\n", realOps);

    expect(await readFile(target, "utf8")).toBe("DATA\n");
  });

  it("creates a deeply nested parent, as a locale layout like de/LC_MESSAGES/ needs", async () => {
    const dir = await makeDir();
    const target = join(dir, "locales", "de", "LC_MESSAGES", "messages.json");

    await atomicWriteFile(target, "DATA\n", realOps);

    expect(await readFile(target, "utf8")).toBe("DATA\n");
  });

  it("leaves no temp file behind when the directory had to be created", async () => {
    const dir = await makeDir();
    const target = join(dir, "de", "common.json");

    await atomicWriteFile(target, "DATA\n", realOps);

    expect(await readdir(join(dir, "de"))).toEqual(["common.json"]);
  });

  it("propagates a directory-creation failure and writes nothing", async () => {
    const dir = await makeDir();
    const target = join(dir, "de", "common.json");
    const ops: AtomicWriteOps = {
      ...realOps,
      mkdir: () => Promise.reject(new Error("mkdir denied")),
    };

    await expect(atomicWriteFile(target, "DATA\n", ops)).rejects.toThrow("mkdir denied");
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("atomicWriteFile: symlink and mode policy", () => {
  /**
   * Pinned deliberately, and pinned in this direction. rename(2) does not resolve the destination
   * symlink, so a link planted in a checkout is clobbered rather than followed. Resolving it would
   * turn any such link into an arbitrary-file-write primitive.
   *
   * If this test ever fails, the fix is NOT to update the expectation. It is to ask why the write
   * started following links. See the `atomicWriteFile` JSDoc for the full policy.
   */
  it("replaces a symlinked target instead of writing through it", async () => {
    const dir = await makeDir();
    const outside = join(dir, "outside.json");
    const link = join(dir, "de.json");
    await writeFile(outside, "ORIGINAL", "utf8");
    await symlink(outside, link);

    await atomicWriteFile(link, "REPLACED", realOps);

    expect((await lstat(link)).isSymbolicLink()).toBe(false);
    expect(await readFile(link, "utf8")).toBe("REPLACED");
    expect(await readFile(outside, "utf8")).toBe("ORIGINAL");
  });

  it("does not preserve the target's mode, which the rename installs a new inode over", async () => {
    const dir = await makeDir();
    const target = join(dir, "de.json");
    await writeFile(target, "before", { encoding: "utf8", mode: 0o600 });
    const inodeBefore = (await lstat(target)).ino;

    await atomicWriteFile(target, "after", realOps);

    const after = await lstat(target);
    expect(after.ino).not.toBe(inodeBefore);
    expect(after.mode & 0o777).not.toBe(0o600);
  });
});
