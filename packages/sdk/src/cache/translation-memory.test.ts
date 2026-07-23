import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { BoundedFileRead } from "../fs.js";
import { makeFakeFs, makeTempDir, readTextFile } from "../test-support.js";
import {
  additionsToRecord,
  applyAdditions,
  CACHE_FILE_NAME,
  cacheFilePath,
  feedTranslationMemory,
  lookupMemory,
  readTranslationMemory,
  writeTranslationMemory,
} from "./translation-memory.js";
import type { TranslationMemory } from "./types.js";

const okRead = (content: string): BoundedFileRead => ({ kind: "ok", content });

function memory(entries: TranslationMemory["entries"]): TranslationMemory {
  return { version: 1, entries };
}

const SAMPLE = memory({ fp1: { de: { h1: "Hallo", h2: "Tschuss" } } });

describe("cacheFilePath", () => {
  it("resolves the cache file as a sibling of the lock file", () => {
    expect(cacheFilePath("/project")).toBe(join("/project", CACHE_FILE_NAME));
    expect(CACHE_FILE_NAME).toBe("verbatra.cache.json");
  });
});

describe("readTranslationMemory: degrade-to-empty", () => {
  it("returns an empty memory for a missing file", async () => {
    const result = await readTranslationMemory("/x", makeFakeFs());
    expect(result).toEqual({ version: 1, entries: {} });
  });

  it("returns an empty memory for an over-cap file", async () => {
    const fs = makeFakeFs({ readFileBounded: async () => ({ kind: "too-large" }) });
    expect(await readTranslationMemory("/x", fs)).toEqual({ version: 1, entries: {} });
  });

  it("returns an empty memory when the read throws a post-open I/O fault", async () => {
    const fs = makeFakeFs({
      readFileBounded: async () => {
        throw new Error("EIO: i/o error after open");
      },
    });
    expect(await readTranslationMemory("/x", fs)).toEqual({ version: 1, entries: {} });
  });

  it("returns an empty memory for unparseable JSON", async () => {
    const fs = makeFakeFs({ readFileBounded: async () => okRead("{not json") });
    expect(await readTranslationMemory("/x", fs)).toEqual({ version: 1, entries: {} });
  });

  it("returns an empty memory for a structurally invalid file", async () => {
    const fs = makeFakeFs({ readFileBounded: async () => okRead('{"version":1,"entries":[]}') });
    expect(await readTranslationMemory("/x", fs)).toEqual({ version: 1, entries: {} });
  });

  it("returns an empty memory for an unrecognized version (older or newer)", async () => {
    const older = makeFakeFs({ readFileBounded: async () => okRead('{"version":0,"entries":{}}') });
    const newer = makeFakeFs({ readFileBounded: async () => okRead('{"version":2,"entries":{}}') });
    expect(await readTranslationMemory("/x", older)).toEqual({ version: 1, entries: {} });
    expect(await readTranslationMemory("/x", newer)).toEqual({ version: 1, entries: {} });
  });

  it("parses a well-formed file", async () => {
    const fs = makeFakeFs({ readFileBounded: async () => okRead(JSON.stringify(SAMPLE)) });
    expect(await readTranslationMemory("/x", fs)).toEqual(SAMPLE);
  });
});

describe("lookupMemory", () => {
  it("returns the cached value on a full match", () => {
    expect(lookupMemory(SAMPLE, "fp1", "de", "h1")).toBe("Hallo");
  });

  it("returns undefined for a missing fingerprint, locale, or hash", () => {
    expect(lookupMemory(SAMPLE, "other", "de", "h1")).toBeUndefined();
    expect(lookupMemory(SAMPLE, "fp1", "fr", "h1")).toBeUndefined();
    expect(lookupMemory(SAMPLE, "fp1", "de", "hZ")).toBeUndefined();
  });
});

describe("applyAdditions", () => {
  it("returns the base unchanged when there is nothing to add", () => {
    expect(applyAdditions(SAMPLE, "fp1", new Map())).toBe(SAMPLE);
  });

  it("adds a new locale and preserves existing locales under the same fingerprint", () => {
    const merged = applyAdditions(SAMPLE, "fp1", new Map([["fr", { h9: "Bonjour" }]]));
    expect(merged.entries.fp1?.de).toEqual({ h1: "Hallo", h2: "Tschuss" });
    expect(merged.entries.fp1?.fr).toEqual({ h9: "Bonjour" });
  });

  it("merges into an existing locale and overwrites a repeated hash", () => {
    const merged = applyAdditions(SAMPLE, "fp1", new Map([["de", { h1: "Hi", h3: "Neu" }]]));
    expect(merged.entries.fp1?.de).toEqual({ h1: "Hi", h2: "Tschuss", h3: "Neu" });
  });

  it("preserves other fingerprints untouched", () => {
    const base = memory({ fp1: { de: { h1: "A" } }, fp2: { de: { h1: "B" } } });
    const merged = applyAdditions(base, "fp1", new Map([["de", { h1: "C" }]]));
    expect(merged.entries.fp2?.de).toEqual({ h1: "B" });
    expect(merged.entries.fp1?.de).toEqual({ h1: "C" });
  });
});

describe("additionsToRecord", () => {
  it("keys each value by its content hash", () => {
    expect(
      additionsToRecord([
        { contentHash: "h1", value: "one" },
        { contentHash: "h2", value: "two" },
      ]),
    ).toEqual({ h1: "one", h2: "two" });
  });
});

describe("writeTranslationMemory", () => {
  it("serializes deterministically with every level's keys sorted", async () => {
    const dir = await makeTempDir();
    const path = cacheFilePath(dir);
    const unsorted = memory({
      fpB: { fr: { z: "1", a: "2" } },
      fpA: { de: { m: "3" } },
    });
    await writeTranslationMemory(path, unsorted, makeFakeFsWriting(dir));
    const written = await readTextFile(path);
    const fpKeys = Object.keys((JSON.parse(written) as TranslationMemory).entries);
    expect(fpKeys).toEqual(["fpA", "fpB"]);
    expect(Object.keys((JSON.parse(written) as TranslationMemory).entries.fpB?.fr ?? {})).toEqual([
      "a",
      "z",
    ]);
    expect(written.endsWith("\n")).toBe(true);
  });
});

describe("feedTranslationMemory", () => {
  it("is a no-op when there are no additions", async () => {
    const writeFile = vi.fn(async () => {});
    await feedTranslationMemory("/x", makeFakeFs({ writeFile }), "fp1", new Map());
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("overlays additions onto the current file and writes once", async () => {
    let stored = JSON.stringify(SAMPLE);
    const fs = makeFakeFs({
      readFileBounded: async () => okRead(stored),
      writeFile: async (_p, data) => {
        stored = data;
      },
    });
    await feedTranslationMemory("/x", fs, "fp1", new Map([["de", { h3: "Neu" }]]));
    const parsed = JSON.parse(stored) as TranslationMemory;
    expect(parsed.entries.fp1?.de).toEqual({ h1: "Hallo", h2: "Tschuss", h3: "Neu" });
  });

  it("swallows a write failure so a cache problem never propagates", async () => {
    const fs = makeFakeFs({
      writeFile: async () => {
        throw new Error("disk full");
      },
    });
    await expect(
      feedTranslationMemory("/x", fs, "fp1", new Map([["de", { h3: "Neu" }]])),
    ).resolves.toBeUndefined();
  });
});

/** A fake fs whose writeFile really writes to disk under `dir`, for serialization round-trips. */
function makeFakeFsWriting(_dir: string): ReturnType<typeof makeFakeFs> {
  return makeFakeFs({
    writeFile: async (path, data) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(path, data, "utf8");
    },
  });
}
