import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { LocaleResource } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { createI18nextJsonAdapter } from "../i18next/i18next-adapter.js";
import { type AtomicWriteOps, atomicWriteFile } from "./atomic-write.js";

const realOps: AtomicWriteOps = {
  writeFile: (path, data) => writeFile(path, data, "utf8"),
  rename: (from, to) => rename(from, to),
  rm: (path) => rm(path, { force: true }),
};

function makeDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "verbatra-aw-"));
}

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
    expect(dirname(tempPath as string)).toBe(dir); // same directory as the target, not the OS temp dir
    expect(await readdir(dir)).toEqual(["en.json"]); // temp renamed away, none left behind
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
    expect(await readFile(target, "utf8")).toBe("OLD\n"); // prior content intact, never truncated
    expect(await readdir(dir)).toEqual(["en.json"]); // temp cleaned up
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
    expect((caught as Error).message).toBe("RENAME_FAIL"); // the ORIGINAL fs error, never the cleanup error
    expect(caught).not.toBeInstanceOf(AdapterError); // no new structured error introduced
  });

  it("cleanup never masks the original error: temp-write fails AND cleanup fails", async () => {
    const dir = await makeDir();
    const target = join(dir, "en.json");
    const ops: AtomicWriteOps = {
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
    await mkdir(target); // a directory at the target path makes the rename fail
    await expect(atomicWriteFile(target, "X\n")).rejects.toThrow();
    const leftovers = (await readdir(dir)).filter((name) => name.startsWith("."));
    expect(leftovers).toEqual([]); // default rm cleaned the temp, none left behind
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
    expect(await readdir(dir)).toEqual(["en.json"]); // routed through the atomic write, no temp litter
  });
});
