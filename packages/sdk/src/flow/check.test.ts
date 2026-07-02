import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { contentHash, type TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { baseConfig, makeFakeFs, makeTempDir, writeJsonFile } from "../test-support.js";
import { check } from "./check.js";

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

describe("check", () => {
  it("reports all up-to-date locales as in sync", async () => {
    // de and fr both carry every source key; with no baseline, present keys are unchanged.
    const dir = await project(
      { a: "A", b: "B" },
      { de: { a: "Aa", b: "Ba" }, fr: { a: "Af", b: "Bf" } },
    );
    const summary = await check({ config: cfg(), cwd: dir });

    expect(summary.inSync).toBe(true);
    expect(summary.locales.map((l) => l.locale)).toEqual(["de", "fr"]);
    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: 0,
      stale: 0,
      upToDate: 2,
      inSync: true,
    });
    expect(summary.locales.every((l) => l.inSync)).toBe(true);
  });

  it("counts missing keys and marks the locale out of sync (missing only)", async () => {
    // de has only one of two keys; fr has no file at all (both keys missing).
    const dir = await project({ a: "A", b: "B" }, { de: { a: "Aa" } });
    const summary = await check({ config: cfg(), cwd: dir });

    expect(summary.inSync).toBe(false);
    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: 1,
      stale: 0,
      upToDate: 1,
      inSync: false,
    });
    expect(summary.locales[1]).toEqual({
      locale: "fr",
      missing: 2,
      stale: 0,
      upToDate: 0,
      inSync: false,
    });
  });

  it("counts stale keys whose source changed since the recorded baseline (stale only)", async () => {
    // de has both keys translated; the lock records the OLD hash for "a", so its drifted source is stale.
    const dir = await project({ a: "A new", b: "B" }, { de: { a: "Aa", b: "Ba" } });
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: { de: { a: contentHash(entry("A old")), b: contentHash(entry("B")) } },
    });

    const summary = await check({ config: cfg({ targetLocales: ["de"] }), cwd: dir });

    expect(summary.inSync).toBe(false);
    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: 0,
      stale: 1,
      upToDate: 1,
      inSync: false,
    });
  });

  it("reports a mixed locale with missing, stale, and up-to-date counts together", async () => {
    // c is missing (no target), a is stale (baseline drifted), b is up to date (baseline matches).
    const dir = await project({ a: "A new", b: "B", c: "C" }, { de: { a: "Aa", b: "Ba" } });
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: { de: { a: contentHash(entry("A old")), b: contentHash(entry("B")) } },
    });

    const summary = await check({ config: cfg({ targetLocales: ["de"] }), cwd: dir });

    expect(summary.locales[0]).toEqual({
      locale: "de",
      missing: 1,
      stale: 1,
      upToDate: 1,
      inSync: false,
    });
    expect(summary.inSync).toBe(false);
  });

  it("honors a valid locales subset and preserves config order", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" }, fr: { a: "Af" } });
    const summary = await check({
      config: cfg(),
      cwd: dir,
      // Requested reversed; the result still follows config order (de, fr).
      locales: ["fr", "de"],
    });

    expect(summary.locales.map((l) => l.locale)).toEqual(["de", "fr"]);
    expect(summary.inSync).toBe(true);
  });

  it("rejects an unknown requested locale with UNKNOWN_LOCALE instead of silently dropping it", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" }, fr: { a: "Af" } });
    await expect(check({ config: cfg(), cwd: dir, locales: ["fr", "es"] })).rejects.toMatchObject({
      code: "UNKNOWN_LOCALE",
    });
  });

  it("writes nothing and never touches the lock (read-only)", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    // A real fs would be fine, but assert the write paths are never reached even when stubbed.
    const fs = makeFakeFs({
      fileExists: async () => true,
      readFileBounded: async () => ({ kind: "missing" }),
      writeFile: async () => {
        throw new Error("check must not write a file");
      },
      writeBytes: async () => {
        throw new Error("check must not write bytes");
      },
    });
    // The adapter still reads real files; only the fs seam (existence/lock/write) is faked.
    const summary = await check({ config: cfg({ targetLocales: ["de"] }), cwd: dir }, { fs });
    expect(summary.locales[0]?.locale).toBe("de");
  });

  it("throws SOURCE_UNREADABLE when the source file is absent", async () => {
    const dir = await makeTempDir();
    await expect(check({ config: cfg({ targetLocales: ["de"] }), cwd: dir })).rejects.toMatchObject(
      { code: "SOURCE_UNREADABLE" },
    );
  });

  it("throws UNKNOWN_FORMAT when no adapter is registered for the format", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    await expect(
      check({ config: cfg({ format: "unknown-format" as VerbatraConfig["format"] }), cwd: dir }),
    ).rejects.toMatchObject({ code: "UNKNOWN_FORMAT" });
  });

  it("throws LOCK_FILE_INVALID when the lock file is corrupt", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    await writeJsonFile(join(dir, "verbatra.lock.json"), "not a lock object");
    await expect(check({ config: cfg({ targetLocales: ["de"] }), cwd: dir })).rejects.toMatchObject(
      { code: "LOCK_FILE_INVALID" },
    );
  });
});
