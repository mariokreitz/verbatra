import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { contentHash, type TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { baseConfig, makeFakeFs, makeTempDir, writeJsonFile } from "../test-support.js";
import { keyIntegrity } from "./key-integrity.js";

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de"], format: "i18next-json", ...overrides });

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

async function withBaseline(
  dir: string,
  locale: string,
  source: Record<string, string>,
): Promise<void> {
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    entries[key] = contentHash(entry(value));
  }
  await writeJsonFile(join(dir, "verbatra.lock.json"), {
    version: 1,
    locales: { [locale]: entries },
  });
}

describe("keyIntegrity", () => {
  it("reports a matching key with placeholders present on both sides", async () => {
    // i18next-json placeholders use double-brace interpolation ({{name}}), not single-brace.
    const source = { greeting: "Hello {{name}} new" };
    const dir = await project(source, { de: { greeting: "Hallo {{name}}" } });
    await withBaseline(dir, "de", { greeting: "Hello {{name}} old" });

    const results = await keyIntegrity({ config: cfg(), cwd: dir });

    expect(results).toEqual([
      {
        locale: "de",
        entries: [
          {
            key: "greeting",
            hasPlaceholders: true,
            matches: true,
            missing: [],
            extra: [],
            icuValid: true,
          },
        ],
      },
    ]);
  });

  it("reports a missing-placeholder mismatch when the target drops a source placeholder", async () => {
    const source = { greeting: "Hello {{name}} new" };
    const dir = await project(source, { de: { greeting: "Hallo" } });
    await withBaseline(dir, "de", { greeting: "Hello {{name}} old" });

    const results = await keyIntegrity({ config: cfg(), cwd: dir });

    expect(results[0]?.entries).toEqual([
      {
        key: "greeting",
        hasPlaceholders: true,
        matches: false,
        missing: ["{{name}}"],
        extra: [],
        icuValid: true,
      },
    ]);
  });

  it("reports an extra-placeholder mismatch when the target invents a placeholder", async () => {
    const source = { greeting: "Hello new" };
    const dir = await project(source, { de: { greeting: "Hallo {{name}}" } });
    await withBaseline(dir, "de", { greeting: "Hello old" });

    const results = await keyIntegrity({ config: cfg(), cwd: dir });

    // Source carries no placeholders, yet the target invented one: this is a real mismatch,
    // not a "no placeholders" neutral case, so matches must be false with the extra reported.
    expect(results[0]?.entries).toEqual([
      {
        key: "greeting",
        hasPlaceholders: false,
        matches: false,
        missing: [],
        extra: ["{{name}}"],
        icuValid: true,
      },
    ]);
  });

  it("reports a key with no placeholders at all as hasPlaceholders: false, matches: true", async () => {
    const source = { plain: "Just text new" };
    const dir = await project(source, { de: { plain: "Nur Text" } });
    await withBaseline(dir, "de", { plain: "Just text old" });

    const results = await keyIntegrity({ config: cfg(), cwd: dir });

    expect(results[0]?.entries).toEqual([
      {
        key: "plain",
        hasPlaceholders: false,
        matches: true,
        missing: [],
        extra: [],
        icuValid: true,
      },
    ]);
  });

  it("reports an ICU-format mismatch through the adapter's branch-aware comparePlaceholders", async () => {
    const source = {
      count: "{count, plural, one {# item {name}} other {# items {name}}}",
    };
    const dir = await project(source, {
      de: { count: "{count, plural, one {# Artikel} other {# Artikel}}" },
    });
    await withBaseline(dir, "de", {
      count: "{count, plural, one {# item {name}} other {# items {name}} old}",
    });

    const results = await keyIntegrity({ config: cfg({ format: "arb" }), cwd: dir });

    expect(results[0]?.entries).toHaveLength(1);
    const found = results[0]?.entries[0];
    expect(found?.key).toBe("count");
    expect(found?.matches).toBe(false);
    expect(found?.missing).toContain("{name}");
    // Syntactically well-formed ICU on the target side, so icuValid is true even though the
    // placeholder check itself failed: the two checks are independent, not short-circuited.
    expect(found?.icuValid).toBe(true);
  });

  it("computes icuValid even when the key already fails the placeholder check, never short-circuited", async () => {
    const source = { count: "{count, plural, one {# item} other {# items}}" };
    const dir = await project(source, { de: { count: "{count, plural, one {Eins" } });
    await withBaseline(dir, "de", {
      count: "{count, plural, one {# item} other {# items} old}",
    });

    const results = await keyIntegrity({ config: cfg({ format: "next-intl-json" }), cwd: dir });

    // The malformed target both fails to parse (icuValid: false) and, as a consequence, loses its
    // placeholder ({count}) under the ICU comparator's fallback (matches: false): both checks run
    // and are both reported, neither one skipped because the other already failed.
    expect(results[0]?.entries).toEqual([
      expect.objectContaining({ key: "count", matches: false, icuValid: false }),
    ]);
  });

  it("reports icuValid: false even when the source carries no placeholders (hasPlaceholders: false, matches trivially true)", async () => {
    const source = { plain: "Just text new" };
    const dir = await project(source, { de: { plain: "Hallo {unbalanced" } });
    await withBaseline(dir, "de", { plain: "Just text old" });

    const results = await keyIntegrity({ config: cfg({ format: "next-intl-json" }), cwd: dir });

    expect(results[0]?.entries).toEqual([
      {
        key: "plain",
        hasPlaceholders: false,
        matches: true,
        missing: [],
        extra: [],
        icuValid: false,
      },
    ]);
  });

  it("checks only changed keys, never missing or orphaned ones", async () => {
    const dir = await project(
      { a: "A new", b: "B", c: "C" },
      { de: { b: "Bb", extra: "leftover" } },
    );
    await withBaseline(dir, "de", { a: "A old", b: "B" });

    const results = await keyIntegrity({ config: cfg(), cwd: dir });

    // a is missing (no target), c is unchanged, extra is orphaned: none of those are checked.
    expect(results[0]?.entries).toEqual([]);
  });

  it("narrows to the requested keys via the keys filter, dropping any that are not changed", async () => {
    const dir = await project({ a: "A new", b: "B new" }, { de: { a: "Aa", b: "Bb" } });
    await withBaseline(dir, "de", { a: "A old", b: "B old" });

    const results = await keyIntegrity({ config: cfg(), cwd: dir, keys: ["a", "not-a-real-key"] });

    expect(results[0]?.entries.map((e) => e.key)).toEqual(["a"]);
  });

  it("honors a locales subset", async () => {
    const dir = await project(
      { greeting: "Hello new" },
      { de: { greeting: "Hallo" }, fr: { greeting: "Bonjour" } },
    );
    await withBaseline(dir, "de", { greeting: "Hello old" });
    await withBaseline(dir, "fr", { greeting: "Hello old" });

    const results = await keyIntegrity({
      config: cfg({ targetLocales: ["de", "fr"] }),
      cwd: dir,
      locales: ["fr"],
    });

    expect(results.map((r) => r.locale)).toEqual(["fr"]);
  });

  it("never exposes the full source or target sentence, only the boolean result and placeholder tokens", async () => {
    const longSourceSentence =
      "Welcome {{name}}, this paragraph describes our product in extensive marketing detail that must never leak.";
    const longTargetSentence =
      "Willkommen, dieser lange deutsche Absatz beschreibt unser Produkt ausfuehrlich und darf niemals nach aussen dringen.";
    const dir = await project(
      { greeting: longSourceSentence },
      { de: { greeting: longTargetSentence } },
    );
    await withBaseline(dir, "de", { greeting: "old value, irrelevant to this check" });

    const results = await keyIntegrity({ config: cfg(), cwd: dir });
    const serialized = JSON.stringify(results);

    expect(serialized).not.toContain(longSourceSentence);
    expect(serialized).not.toContain(longTargetSentence);
    expect(serialized).not.toContain("marketing detail");
    expect(serialized).not.toContain("Absatz");
    expect(serialized).toContain("{{name}}");
  });

  it("accepts an injected file system seam, exercising the deps.fs branch instead of the default", async () => {
    const dir = await project({ greeting: "Hello new" }, { de: { greeting: "Hallo" } });
    await withBaseline(dir, "de", { greeting: "Hello old" });

    const fs = makeFakeFs({
      fileExists: async () => true,
      readFileBounded: async () => ({ kind: "missing" }),
      writeFile: async () => {
        throw new Error("keyIntegrity must not write a file");
      },
    });
    // The adapter still reads the real files on disk directly; only the lock-file read (which
    // goes through the SdkFs seam) is faked, so the on-disk baseline is invisible here and
    // "greeting" reads as unchanged rather than changed. This proves the injected fs took
    // effect: the real on-disk lock file would otherwise report it as changed.
    const results = await keyIntegrity({ config: cfg(), cwd: dir }, { fs });

    expect(results[0]?.locale).toBe("de");
    expect(results[0]?.entries).toEqual([]);
  });

  it("defaults the working directory to process.cwd() when cwd is omitted", async () => {
    const dir = await project({ greeting: "Hello new" }, { de: { greeting: "Hallo" } });
    await withBaseline(dir, "de", { greeting: "Hello old" });
    const previous = process.cwd();
    try {
      process.chdir(dir);
      const results = await keyIntegrity({ config: cfg() });
      expect(results[0]?.locale).toBe("de");
      expect(results[0]?.entries).toEqual([
        {
          key: "greeting",
          hasPlaceholders: false,
          matches: true,
          missing: [],
          extra: [],
          icuValid: true,
        },
      ]);
    } finally {
      process.chdir(previous);
    }
  });

  it("throws SOURCE_UNREADABLE when the source file is absent", async () => {
    const dir = await makeTempDir();
    await expect(keyIntegrity({ config: cfg(), cwd: dir })).rejects.toMatchObject({
      code: "SOURCE_UNREADABLE",
    });
  });

  it("throws UNKNOWN_FORMAT when no adapter is registered for the format", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    await expect(
      keyIntegrity({
        config: cfg({ format: "unknown-format" as VerbatraConfig["format"] }),
        cwd: dir,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_FORMAT" });
  });

  it("throws UNKNOWN_LOCALE when a requested locale is not configured", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    await expect(keyIntegrity({ config: cfg(), cwd: dir, locales: ["es"] })).rejects.toMatchObject({
      code: "UNKNOWN_LOCALE",
    });
  });

  it("throws LOCK_FILE_INVALID when the lock file is corrupt", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    await writeJsonFile(join(dir, "verbatra.lock.json"), "not a lock object");
    await expect(keyIntegrity({ config: cfg(), cwd: dir })).rejects.toMatchObject({
      code: "LOCK_FILE_INVALID",
    });
  });
});
