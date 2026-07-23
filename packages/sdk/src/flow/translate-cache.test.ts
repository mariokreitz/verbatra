import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ReviewFlag,
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
  Usage,
} from "@verbatra/ai-providers";
import { buildWorkbook, readWorkbook } from "@verbatra/exchange";
import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../cache/fingerprint.js";
import { cacheFilePath, readTranslationMemory } from "../cache/translation-memory.js";
import type { TranslationMemory } from "../cache/types.js";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs } from "../fs.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  readTextFile,
  writeJsonFile,
} from "../test-support.js";
import { check } from "./check.js";
import { diff } from "./diff.js";
import { editEntry } from "./edit-entry.js";
import { retranslateEntry } from "./retranslate-entry.js";
import { translate } from "./translate-project.js";
import { exportWorkbook } from "./workbook/export-workbook.js";
import { importWorkbook } from "./workbook/import-workbook.js";

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de"], ...overrides });

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

function targetPath(dir: string, locale: string): string {
  return join(dir, "locales", `${locale}.json`);
}

async function setSource(dir: string, source: Record<string, unknown>): Promise<void> {
  await writeJsonFile(join(dir, "locales", "en.json"), source);
}

async function readTarget(dir: string, locale: string): Promise<Record<string, string>> {
  return (await readJsonFile(targetPath(dir, locale))) as Record<string, string>;
}

async function loadCache(dir: string): Promise<TranslationMemory> {
  return readTranslationMemory(cacheFilePath(dir), defaultFs);
}

function localeCacheKeys(cache: TranslationMemory, fingerprint: string, locale: string): string[] {
  return Object.keys(cache.entries[fingerprint]?.[locale] ?? {});
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fillWorkbook(
  path: string,
  locale: string,
  fills: Readonly<Record<string, string>>,
): Promise<void> {
  const data = await readWorkbook(new Uint8Array(await readFile(path)));
  const sheets = data.sheets.map((sheet) =>
    sheet.locale !== locale
      ? sheet
      : {
          locale: sheet.locale,
          rows: sheet.rows.map((row) =>
            fills[row.key] !== undefined ? { ...row, translation: fills[row.key] as string } : row,
          ),
        },
  );
  await writeFile(path, await buildWorkbook({ sheets }));
}

/** Total usage of exactly 100 tokens per call, for tripping a small budget deterministically. */
const USAGE_100: Usage = { inputTokens: 60, outputTokens: 40 };

/** An offline provider that translates every entry and attaches a review flag to exactly one key. */
function reviewFlaggingProvider(flaggedKey: string): TranslationProvider {
  return {
    id: "stub",
    kind: "llm",
    supportsGlossary: true,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      const values = new Map<string, string>();
      for (const entry of request.entries) {
        values.set(entry.key, `[${request.targetLocale}] ${entry.value}`);
      }
      const reviewFlags = new Map<string, ReviewFlag>([
        [flaggedKey, { status: "review", reasons: ["EQUALS_SOURCE"] }],
      ]);
      return { values, integrity: new Map(), reviewFlags };
    },
  };
}

describe("translation-memory cache: cross-key reuse", () => {
  it("reuses a renamed key's translation with zero provider calls, applied silently", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    const first = makeStubProvider();
    await translate({ config: cfg(), cwd: dir }, { createProvider: () => first.provider });
    expect(first.calls).toHaveLength(1);

    await setSource(dir, { b: "Hello" });
    const second = makeStubProvider();
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => second.provider },
    );

    expect(second.calls).toHaveLength(0);
    expect((await readTarget(dir, "de")).b).toBe("[de] Hello");
    expect(summary.locales[0]?.cacheHits).toEqual(["b"]);
    expect(summary.locales[0]?.translated).toEqual([]);
    expect(summary.locales[0]?.needsReview).toEqual([]);
  });

  it("translates byte-identical source content once per locale and fans the value to every key, even across batch splits", async () => {
    const dir = await project({ a: "Hello", b: "Hello" }, { de: {} });
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg({ maxBatchSize: 1 }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    // maxBatchSize 1 would put each key in its own request without content dedup; the shared string
    // is instead sent exactly once and fanned out to both keys.
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls.flatMap((c) => c.request.entries.map((e) => e.value))).toEqual(["Hello"]);

    const de = await readTarget(dir, "de");
    expect(de.a).toBe("[de] Hello");
    expect(de.b).toBe("[de] Hello");
    expect([...(summary.locales[0]?.translated ?? [])].sort()).toEqual(["a", "b"]);
    expect(localeCacheKeys(await loadCache(dir), computeFingerprint(cfg()), "de")).toHaveLength(1);
  });

  it("withholds every key sharing content when the representative fails the integrity gate", async () => {
    const dir = await project({ a: "Hi {{name}}", b: "Hi {{name}}" }, { de: {} });
    const stub = makeStubProvider({ failIntegrity: new Set(["a"]) });
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(1);
    expect([...(summary.locales[0]?.integrityMismatches ?? [])].sort()).toEqual(["a", "b"]);
    expect(summary.locales[0]?.translated).toEqual([]);
    expect(summary.locales[0]?.status).toBe("failed");
    expect(await fileExists(cacheFilePath(dir))).toBe(false);
  });

  it("withholds every key sharing content when the provider returns no value for the representative", async () => {
    const dir = await project({ a: "Hello", b: "Hello" }, { de: {} });
    const stub = makeStubProvider({ missingValues: new Set(["a"]) });
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(1);
    expect([...(summary.locales[0]?.providerFailures ?? [])].sort()).toEqual(["a", "b"]);
    expect(summary.locales[0]?.translated).toEqual([]);
  });

  it("fans a review flag out to every key sharing the representative's content", async () => {
    const dir = await project({ a: "Hello", b: "Hello" }, { de: {} });
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => reviewFlaggingProvider("a") },
    );

    expect((summary.locales[0]?.needsReview ?? []).map((flag) => flag.key).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("withholds every duplicate when the representative is budget-withheld", async () => {
    // Candidates are processed in key order (a_solo first). a_solo trips the budget, so the later
    // duplicated group (z_a, z_b) never reaches the provider and its representative is budget-withheld.
    const dir = await project({ a_solo: "Solo", z_a: "Dup", z_b: "Dup" }, { de: {} });
    const stub = makeStubProvider({ usage: USAGE_100 });
    const summary = await translate(
      { config: cfg({ maxTokens: 50, budgetBehavior: "stop", maxBatchSize: 1 }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect([...(summary.locales[0]?.budgetWithheld ?? [])].sort()).toEqual(["z_a", "z_b"]);
    expect(summary.locales[0]?.translated).toEqual(["a_solo"]);
  });

  it("reuses deterministically: the same rename flow yields a byte-identical target both times", async () => {
    async function renameFlow(): Promise<string> {
      const dir = await project({ a: "Hello" }, { de: {} });
      await translate(
        { config: cfg(), cwd: dir },
        { createProvider: () => makeStubProvider().provider },
      );
      await setSource(dir, { b: "Hello" });
      const second = makeStubProvider();
      await translate({ config: cfg(), cwd: dir }, { createProvider: () => second.provider });
      expect(second.calls).toHaveLength(0);
      return readTextFile(targetPath(dir, "de"));
    }
    expect(await renameFlow()).toBe(await renameFlow());
  });
});

describe("translation-memory cache: fingerprint and gate", () => {
  it("does not serve a cached value under a changed fingerprint (tone)", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    await translate(
      { config: cfg({ tone: "formal" }), cwd: dir },
      { createProvider: () => makeStubProvider().provider },
    );

    await setSource(dir, { b: "Hello" });
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg({ tone: "informal" }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(1);
    expect(summary.locales[0]?.cacheHits).toEqual([]);
  });

  it("discards a hit that fails placeholder integrity and sends the key to the provider", async () => {
    const dir = await project({ a: "Hi {{name}}" }, { de: {} });
    await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => makeStubProvider().provider },
    );

    const fingerprint = computeFingerprint(cfg());
    const [hash] = localeCacheKeys(await loadCache(dir), fingerprint, "de");
    expect(hash).toBeDefined();
    await writeFile(
      cacheFilePath(dir),
      `${JSON.stringify({ version: 1, entries: { [fingerprint]: { de: { [hash as string]: "Hallo" } } } })}\n`,
    );

    await setSource(dir, { b: "Hi {{name}}" });
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(1);
    expect(summary.locales[0]?.cacheHits).toEqual([]);
    expect(summary.locales[0]?.translated).toEqual(["b"]);
    expect((await readTarget(dir, "de")).b).toBe("[de] Hi {{name}}");
  });
});

describe("translation-memory cache: resilience", () => {
  it.each([
    ["unparseable", "{ not json"],
    ["wrong version", '{"version":99,"entries":{}}'],
  ])("degrades a %s cache to empty and the run still succeeds", async (_label, contents) => {
    const dir = await project({ a: "Hello" }, { de: {} });
    await writeFile(cacheFilePath(dir), contents);
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.succeeded).toEqual(["de"]);
    expect(stub.calls).toHaveLength(1);
    expect((await readTarget(dir, "de")).a).toBe("[de] Hello");
  });

  it("does not read or write the cache on a dry-run", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    const summary = await translate({ config: cfg(), cwd: dir, dryRun: true });

    expect(await fileExists(cacheFilePath(dir))).toBe(false);
    expect(summary.locales[0]?.cacheHits).toEqual([]);
  });
});

describe("translation-memory cache: bypass", () => {
  it("with cache disabled makes the same provider call and leaves the cache file byte-untouched", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => makeStubProvider().provider },
    );
    const before = await readTextFile(cacheFilePath(dir));

    await setSource(dir, { b: "Hello" });
    const stub = makeStubProvider();
    await translate(
      { config: cfg(), cwd: dir, cache: false },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(1);
    expect(await readTextFile(cacheFilePath(dir))).toBe(before);
  });
});

describe("translation-memory cache: interaction with prune, check, diff", () => {
  it("keeps the content-keyed TM entry when prune removes the orphaned key", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => makeStubProvider().provider },
    );
    const fingerprint = computeFingerprint(cfg());
    const before = localeCacheKeys(await loadCache(dir), fingerprint, "de");

    await setSource(dir, { b: "Hello" });
    await translate(
      { config: cfg(), cwd: dir, prune: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(localeCacheKeys(await loadCache(dir), fingerprint, "de")).toEqual(before);
    const de = await readTarget(dir, "de");
    expect(de.a).toBeUndefined();
    expect(de.b).toBe("[de] Hello");
  });

  it("leaves check and diff output identical whether or not the cache is present", async () => {
    const dir = await project({ a: "Hello", b: "World" }, { de: { a: "Hallo" } });
    const checkBefore = await check({ config: cfg(), cwd: dir });
    const diffBefore = await diff({ config: cfg(), cwd: dir });

    const fingerprint = computeFingerprint(cfg());
    await writeFile(
      cacheFilePath(dir),
      `${JSON.stringify({ version: 1, entries: { [fingerprint]: { de: { someHash: "X" } } } })}\n`,
    );

    expect(await check({ config: cfg(), cwd: dir })).toEqual(checkBefore);
    expect(await diff({ config: cfg(), cwd: dir })).toEqual(diffBefore);
  });
});

describe("translation-memory cache: fed by the single-key and workbook write paths", () => {
  it("serves an editEntry value from the TM on a later run", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    const result = await editEntry({
      config: cfg(),
      cwd: dir,
      locale: "de",
      key: "a",
      value: "Servus",
    });
    expect(result.accepted).toBe(true);

    await setSource(dir, { b: "Hello" });
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(0);
    expect((await readTarget(dir, "de")).b).toBe("Servus");
    expect(summary.locales[0]?.cacheHits).toEqual(["b"]);
  });

  it("serves a retranslateEntry value from the TM on a later run", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    const first = makeStubProvider();
    await retranslateEntry(
      { config: cfg(), cwd: dir, locale: "de", key: "a" },
      { createProvider: () => first.provider },
    );
    expect(first.calls).toHaveLength(1);

    await setSource(dir, { b: "Hello" });
    const second = makeStubProvider();
    await translate({ config: cfg(), cwd: dir }, { createProvider: () => second.provider });

    expect(second.calls).toHaveLength(0);
    expect((await readTarget(dir, "de")).b).toBe("[de] Hello");
  });

  it("serves an importWorkbook value from the TM on a later run", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    const exported = await exportWorkbook({ config: cfg(), cwd: dir });
    await fillWorkbook(exported.path, "de", { a: "Servus" });
    await importWorkbook({ config: cfg(), workbook: exported.path, cwd: dir });

    await setSource(dir, { b: "Hello" });
    const stub = makeStubProvider();
    await translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider });

    expect(stub.calls).toHaveLength(0);
    expect((await readTarget(dir, "de")).b).toBe("Servus");
  });

  it("does not feed the cache on a dry-run import", async () => {
    const dir = await project({ a: "Hello" }, { de: {} });
    const exported = await exportWorkbook({ config: cfg(), cwd: dir });
    await fillWorkbook(exported.path, "de", { a: "Servus" });
    await importWorkbook({ config: cfg(), workbook: exported.path, cwd: dir, dryRun: true });

    expect(await fileExists(cacheFilePath(dir))).toBe(false);
  });
});
