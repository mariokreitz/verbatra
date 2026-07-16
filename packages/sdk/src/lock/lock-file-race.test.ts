import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
} from "@verbatra/ai-providers";
import { buildWorkbook, readWorkbook } from "@verbatra/exchange";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { retranslateEntry } from "../flow/retranslate-entry.js";
import { translate } from "../flow/translate-project.js";
import { exportWorkbook } from "../flow/workbook/export-workbook.js";
import { importWorkbook } from "../flow/workbook/import-workbook.js";
import { defaultFs } from "../fs.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  writeJsonFile,
} from "../test-support.js";

function sleep(ms: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

/**
 * Wraps a provider's `translateBatch` with a delay, so a real, unforced `Promise.all` of two
 * calls genuinely interleaves around the delayed call rather than one completing before the other
 * even starts. This is what makes the tests below exercise real concurrency (the actual gap
 * between a locale-file read and its write) instead of a scripted single-process interleaving.
 */
function delayedProvider(base: TranslationProvider, delayMs: number): TranslationProvider {
  return {
    ...base,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      await sleep(delayMs);
      return base.translateBatch(request);
    },
  };
}

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de", "fr"], format: "i18next-json", ...overrides });

async function project(source: Record<string, unknown>): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  return dir;
}

async function lockLocales(dir: string): Promise<Record<string, Record<string, string>>> {
  const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
    locales: Record<string, Record<string, string>>;
  };
  return lock.locales;
}

async function targetLocaleFile(dir: string, locale: string): Promise<Record<string, string>> {
  const raw = (await readJsonFile(join(dir, "locales", `${locale}.json`))) as Record<
    string,
    string
  >;
  return raw;
}

describe("withLocaleWriteLock closes gap 2: two concurrent retranslateEntry calls on the same locale", () => {
  it("both keys survive in the locale file's actual written content, not only the lock file", async () => {
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const stub = makeStubProvider();
    const providerA = delayedProvider(stub.provider, 30);
    const providerB = delayedProvider(stub.provider, 5);

    const [resultA, resultB] = await Promise.all([
      retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "greeting" },
        { createProvider: () => providerA },
      ),
      retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "farewell" },
        { createProvider: () => providerB },
      ),
    ]);

    expect(resultA.accepted).toBe(true);
    expect(resultB.accepted).toBe(true);

    const target = await targetLocaleFile(dir, "de");
    expect(target.greeting).toBe("[de] Hello");
    expect(target.farewell).toBe("[de] Goodbye");

    const locales = await lockLocales(dir);
    expect(locales.de?.greeting).toBeDefined();
    expect(locales.de?.farewell).toBeDefined();
  });
});

describe("withLocaleWriteLock: retranslateEntry versus a concurrent CLI translate run on the SAME locale", () => {
  it("neither writer's write is lost when both target the same locale concurrently", async () => {
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const stub = makeStubProvider();

    await retranslateEntry(
      { config: cfg(), cwd: dir, locale: "de", key: "greeting" },
      { createProvider: () => stub.provider },
    );

    const [retranslateResult, translateSummary] = await Promise.all([
      retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "greeting" },
        { createProvider: () => delayedProvider(stub.provider, 30) },
      ),
      translate(
        { config: cfg({ targetLocales: ["de"] }), cwd: dir },
        { createProvider: () => delayedProvider(stub.provider, 5) },
      ),
    ]);

    expect(retranslateResult.accepted).toBe(true);
    expect(translateSummary.failed).toEqual([]);

    const target = await targetLocaleFile(dir, "de");
    expect(target.greeting).toBe("[de] Hello");
    expect(target.farewell).toBe("[de] Goodbye");

    const locales = await lockLocales(dir);
    expect(locales.de?.greeting).toBeDefined();
    expect(locales.de?.farewell).toBeDefined();
  });
});

describe("withLocaleWriteLock: retranslateEntry versus a concurrent Excel import on the SAME locale", () => {
  it("neither writer's write is lost when both target the same locale concurrently", async () => {
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const stub = makeStubProvider();

    const out = await exportWorkbook({ config: cfg({ targetLocales: ["de"] }), cwd: dir });
    const data = await readWorkbook(new Uint8Array(await readFile(out.path)));
    const filled = data.sheets.map((sheet) => ({
      locale: sheet.locale,
      rows: sheet.rows.map((row) =>
        row.key === "greeting"
          ? row
          : { ...row, translation: `${row.translation || row.source} DE` },
      ),
    }));
    const workbookBytes = await buildWorkbook({ sheets: filled });
    await defaultFs.writeBytes(out.path, workbookBytes);

    const [retranslateResult, importSummary] = await Promise.all([
      retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "greeting" },
        { createProvider: () => delayedProvider(stub.provider, 30) },
      ),
      importWorkbook({ config: cfg({ targetLocales: ["de"] }), workbook: out.path, cwd: dir }),
    ]);

    expect(retranslateResult.accepted).toBe(true);
    expect(importSummary.failed).toEqual([]);

    const target = await targetLocaleFile(dir, "de");
    expect(target.greeting).toBe("[de] Hello");
    expect(target.farewell).toBe("Goodbye DE");

    const locales = await lockLocales(dir);
    expect(locales.de?.greeting).toBeDefined();
    expect(locales.de?.farewell).toBeDefined();
  });
});
