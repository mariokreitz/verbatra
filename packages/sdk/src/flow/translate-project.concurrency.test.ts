import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
} from "@verbatra/ai-providers";
import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  writeJsonFile,
} from "../test-support.js";
import { translate } from "./translate-project.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface RecordedCall {
  readonly locale: string;
  readonly keys: readonly string[];
  readonly index: number;
}

const PASS: PlaceholderIntegrityResult = {
  matches: true,
  missing: [],
  extra: [],
  reordered: false,
};

function makeDelayedCountingProvider(delayMs: number): {
  readonly provider: TranslationProvider;
  readonly calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const provider: TranslationProvider = {
    id: "counting-stub",
    kind: "llm",
    supportsGlossary: false,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      const index = calls.length;
      calls.push({ locale: request.targetLocale, keys: request.entries.map((e) => e.key), index });
      await sleep(delayMs);
      const values = new Map<string, string>();
      const integrity = new Map<string, PlaceholderIntegrityResult>();
      for (const entry of request.entries) {
        values.set(entry.key, `[${request.targetLocale}#${index}] ${entry.value}`);
        integrity.set(entry.key, PASS);
      }
      return { values, integrity };
    },
  };
  return { provider, calls };
}

async function project(source: Record<string, unknown>): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  return dir;
}

function sourcePath(dir: string): string {
  return join(dir, "locales", "en.json");
}

function targetPath(dir: string, locale: string): string {
  return join(dir, "locales", `${locale}.json`);
}

function callsFor(calls: readonly RecordedCall[], locale: string, key: string): RecordedCall[] {
  return calls.filter((call) => call.locale === locale && call.keys.includes(key));
}

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de", "fr"], ...overrides });

describe("translate: concurrent whole-project calls never duplicate a provider call for an already-stale key", () => {
  it("calls the provider at most once per (locale, key) once the source changes, and writes exactly the winning call's content", async () => {
    const dir = await project({ a: "A1" });
    const seed = makeStubProvider();
    await translate({ config: cfg(), cwd: dir }, { createProvider: () => seed.provider });

    await writeJsonFile(sourcePath(dir), { a: "A2" });

    const { provider, calls } = makeDelayedCountingProvider(50);

    const [first, second] = await Promise.all([
      translate({ config: cfg(), cwd: dir }, { createProvider: () => provider }),
      translate({ config: cfg(), cwd: dir }, { createProvider: () => provider }),
    ]);

    expect(first.failed).toEqual([]);
    expect(second.failed).toEqual([]);

    for (const locale of ["de", "fr"] as const) {
      const localeCalls = callsFor(calls, locale, "a");
      expect(localeCalls).toHaveLength(1);

      const winner = localeCalls[0];
      if (winner === undefined) {
        throw new Error(`expected exactly one call for locale ${locale}`);
      }
      const written = (await readJsonFile(targetPath(dir, locale))) as Record<string, string>;
      expect(written).toEqual({ a: `[${locale}#${winner.index}] A2` });
    }
  });
});
