import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { contentHash, type TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { baseConfig, makeFakeFs, makeTempDir, writeJsonFile } from "../test-support.js";
import { diff } from "./diff.js";

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de", "fr"], format: "i18next-json", ...overrides });

async function project(
  source: Record<string, unknown>,
  targets: Record<string, Record<string, unknown> | undefined>,
): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  for (const [locale, obj] of Object.entries(targets)) {
    if (obj !== undefined) {
      await writeJsonFile(join(dir, "locales", `${locale}.json`), obj);
    }
  }
  return dir;
}

function entry(value: string, placeholders: readonly string[] = []): TranslationEntry {
  return { key: "k", namespace: "en", value, placeholders, isPlural: false };
}

describe("diff", () => {
  it("reports no pending changes when every locale carries the source keys", async () => {
    const dir = await project(
      { a: "A", b: "B" },
      { de: { a: "Aa", b: "Ba" }, fr: { a: "Af", b: "Bf" } },
    );
    const summary = await diff({ config: cfg(), cwd: dir });

    expect(summary.hasPendingChanges).toBe(false);
    expect(summary.locales.map((l) => l.locale)).toEqual(["de", "fr"]);
    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: [],
      changed: [],
      orphaned: [],
      hasPendingChanges: false,
    });
  });

  it("lists missing keys and marks the locale pending (missing only)", async () => {
    // de has only one of two keys; fr has no file at all (both keys missing).
    const dir = await project({ a: "A", b: "B" }, { de: { a: "Aa" } });
    const summary = await diff({ config: cfg(), cwd: dir });

    expect(summary.hasPendingChanges).toBe(true);
    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: ["b"],
      changed: [],
      orphaned: [],
      hasPendingChanges: true,
    });
    expect(summary.locales[1]).toEqual({
      locale: "fr",
      missing: ["a", "b"],
      changed: [],
      orphaned: [],
      hasPendingChanges: true,
    });
  });

  it("lists changed keys whose source drifted from the recorded baseline (changed only)", async () => {
    const dir = await project({ a: "A new", b: "B" }, { de: { a: "Aa", b: "Ba" } });
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: { de: { a: contentHash(entry("A old")), b: contentHash(entry("B")) } },
    });

    const summary = await diff({ config: cfg({ targetLocales: ["de"] }), cwd: dir });

    expect(summary.hasPendingChanges).toBe(true);
    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: [],
      changed: ["a"],
      orphaned: [],
      hasPendingChanges: true,
    });
  });

  it("lists orphaned keys but they alone do NOT set hasPendingChanges", async () => {
    // de carries every source key plus an extra key absent from source -> orphaned only.
    const dir = await project({ a: "A" }, { de: { a: "Aa", legacy: "old" } });
    const summary = await diff({ config: cfg({ targetLocales: ["de"] }), cwd: dir });

    expect(summary.hasPendingChanges).toBe(false);
    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: [],
      changed: [],
      orphaned: ["legacy"],
      hasPendingChanges: false,
    });
  });

  it("reports a mixed locale with missing, changed, and orphaned lists together", async () => {
    // c is missing, a is changed (baseline drifted), legacy is orphaned; b is up to date.
    const dir = await project(
      { a: "A new", b: "B", c: "C" },
      { de: { a: "Aa", b: "Ba", legacy: "old" } },
    );
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: { de: { a: contentHash(entry("A old")), b: contentHash(entry("B")) } },
    });

    const summary = await diff({ config: cfg({ targetLocales: ["de"] }), cwd: dir });

    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: ["c"],
      changed: ["a"],
      orphaned: ["legacy"],
      hasPendingChanges: true,
    });
    expect(summary.hasPendingChanges).toBe(true);
  });

  it("honors a valid locales subset and preserves config order", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" }, fr: { a: "Af" } });
    const summary = await diff({ config: cfg(), cwd: dir, locales: ["fr", "de"] });

    expect(summary.locales.map((l) => l.locale)).toEqual(["de", "fr"]);
    expect(summary.hasPendingChanges).toBe(false);
  });

  it("rejects an unknown requested locale with UNKNOWN_LOCALE instead of silently dropping it", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" }, fr: { a: "Af" } });
    await expect(diff({ config: cfg(), cwd: dir, locales: ["fr", "es"] })).rejects.toMatchObject({
      code: "UNKNOWN_LOCALE",
    });
  });

  it("writes nothing and never touches the lock (read-only)", async () => {
    const dir = await project({ a: "A", b: "B" }, { de: { a: "Aa" } });
    const fs = makeFakeFs({
      fileExists: async () => true,
      readFileBounded: async () => ({ kind: "missing" }),
      writeFile: async () => {
        throw new Error("diff must not write a file");
      },
      writeBytes: async () => {
        throw new Error("diff must not write bytes");
      },
    });
    const summary = await diff({ config: cfg({ targetLocales: ["de"] }), cwd: dir }, { fs });
    expect(summary.locales[0]?.locale).toBe("de");
  });

  it("defaults the working directory to process.cwd() when cwd is omitted", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    const previous = process.cwd();
    try {
      process.chdir(dir);
      const summary = await diff({ config: cfg({ targetLocales: ["de"] }) });
      expect(summary.hasPendingChanges).toBe(false);
      expect(summary.locales[0]?.locale).toBe("de");
    } finally {
      process.chdir(previous);
    }
  });

  it("throws SOURCE_UNREADABLE when the source file is absent", async () => {
    const dir = await makeTempDir();
    await expect(diff({ config: cfg({ targetLocales: ["de"] }), cwd: dir })).rejects.toMatchObject({
      code: "SOURCE_UNREADABLE",
    });
  });

  it("throws UNKNOWN_FORMAT when no adapter is registered for the format", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    await expect(
      diff({ config: cfg({ format: "unknown-format" as VerbatraConfig["format"] }), cwd: dir }),
    ).rejects.toMatchObject({ code: "UNKNOWN_FORMAT" });
  });

  it("throws LOCK_FILE_INVALID when the lock file is corrupt", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    await writeJsonFile(join(dir, "verbatra.lock.json"), "not a lock object");
    await expect(diff({ config: cfg({ targetLocales: ["de"] }), cwd: dir })).rejects.toMatchObject({
      code: "LOCK_FILE_INVALID",
    });
  });
});
