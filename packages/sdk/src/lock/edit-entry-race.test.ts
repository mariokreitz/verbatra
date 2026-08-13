import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
} from "@verbatra/ai-providers";
import {
  AdapterRegistry,
  createDefaultRegistry,
  type FormatAdapter,
} from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { editEntry } from "../flow/edit-entry.js";
import { retranslateEntry } from "../flow/retranslate-entry.js";
import { translate } from "../flow/translate-project.js";
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

function delayedProvider(base: TranslationProvider, delayMs: number): TranslationProvider {
  return {
    ...base,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      await sleep(delayMs);
      return base.translateBatch(request);
    },
  };
}

function delayedReadRegistry(
  format: VerbatraConfig["format"],
  delayedLocale: string,
  delayMs: number,
): AdapterRegistry {
  const resolution = createDefaultRegistry().resolve("", { format });
  if (resolution.status !== "resolved") {
    throw new Error(`no adapter registered for format "${format}"`);
  }
  const base = resolution.adapter;
  const delayed: FormatAdapter = {
    ...base,
    read: async (filePath: string, locale: string) => {
      const result = await base.read(filePath, locale);
      if (locale === delayedLocale) {
        await sleep(delayMs);
      }
      return result;
    },
  };
  return new AdapterRegistry().register(delayed);
}

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de"], format: "i18next-json", ...overrides });

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
  return (await readJsonFile(join(dir, "locales", `${locale}.json`))) as Record<string, string>;
}

describe("withLocaleWriteLock: editEntry versus a concurrent CLI translate run on the SAME locale", () => {
  it("neither writer's write is lost when both target the same locale concurrently", async () => {
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const stub = makeStubProvider();

    await editEntry({ config: cfg(), cwd: dir, locale: "de", key: "greeting", value: "seed" });

    const [editResult, translateSummary] = await Promise.all([
      editEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "greeting", value: "Hallo" },
        { adapterRegistry: delayedReadRegistry(cfg().format, "de", 30) },
      ),
      translate(
        { config: cfg({ targetLocales: ["de"] }), cwd: dir },
        { createProvider: () => delayedProvider(stub.provider, 5) },
      ),
    ]);

    expect(editResult.accepted).toBe(true);
    expect(translateSummary.failed).toEqual([]);

    const target = await targetLocaleFile(dir, "de");
    expect(target.greeting).toBe("Hallo");
    expect(target.farewell).toBe("[de] Goodbye");

    const locales = await lockLocales(dir);
    expect(locales.de?.greeting).toBeDefined();
    expect(locales.de?.farewell).toBeDefined();
  });
});

describe("withLocaleWriteLock: editEntry versus a concurrent retranslateEntry call on the SAME locale", () => {
  it("neither writer's write is lost when both target the same locale concurrently", async () => {
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const stub = makeStubProvider();

    const [editResult, retranslateResult] = await Promise.all([
      editEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "greeting", value: "Hallo" },
        { adapterRegistry: delayedReadRegistry(cfg().format, "de", 30) },
      ),
      retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "farewell" },
        { createProvider: () => delayedProvider(stub.provider, 5) },
      ),
    ]);

    expect(editResult.accepted).toBe(true);
    expect(retranslateResult.accepted).toBe(true);

    const target = await targetLocaleFile(dir, "de");
    expect(target.greeting).toBe("Hallo");
    expect(target.farewell).toBe("[de] Goodbye");

    const locales = await lockLocales(dir);
    expect(locales.de?.greeting).toBeDefined();
    expect(locales.de?.farewell).toBeDefined();
  });
});
