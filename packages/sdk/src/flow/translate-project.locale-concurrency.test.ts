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
import { SdkError } from "../errors.js";
import { lockFilePath } from "../lock/lock-file.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readTextFile,
  writeJsonFile,
} from "../test-support.js";
import { translate } from "./translate-project.js";

const PASS: PlaceholderIntegrityResult = {
  matches: true,
  missing: [],
  extra: [],
  reordered: false,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface ProbeStats {
  readonly maxInFlight: number;
  readonly arrived: number;
}

interface ProbeOptions {
  /**
   * When set, every provider call blocks until this many calls have arrived, then all are released.
   * A pool that never runs this many locales at once would deadlock the test, so a passing run proves
   * the pool reaches the width. `gateAt` must not exceed the locale count.
   */
  readonly gateAt?: number;
  /** A flat delay applied to every call when `gateAt` is unset. */
  readonly delayMs?: number;
  /** A per-locale delay (when `gateAt` is unset) used to make completion order diverge from source order. */
  readonly delayByLocale?: Readonly<Record<string, number>>;
}

/**
 * A provider that records the maximum number of `translateBatch` calls in flight at once (incremented
 * on entry, decremented on exit), so a test can assert the pool's width by counting rather than timing.
 */
function makeConcurrencyProbe(options: ProbeOptions): {
  readonly provider: TranslationProvider;
  readonly stats: () => ProbeStats;
} {
  let inFlight = 0;
  let maxInFlight = 0;
  let arrived = 0;
  let openGate: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });

  async function wait(targetLocale: string): Promise<void> {
    if (options.gateAt !== undefined) {
      await gate;
      return;
    }
    const ms = options.delayByLocale?.[targetLocale] ?? options.delayMs ?? 0;
    if (ms > 0) {
      await sleep(ms);
    }
  }

  const provider: TranslationProvider = {
    id: "probe",
    kind: "llm",
    supportsGlossary: true,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      inFlight += 1;
      if (inFlight > maxInFlight) {
        maxInFlight = inFlight;
      }
      arrived += 1;
      if (options.gateAt !== undefined && arrived >= options.gateAt) {
        openGate();
      }
      await wait(request.targetLocale);
      const values = new Map<string, string>();
      const integrity = new Map<string, PlaceholderIntegrityResult>();
      for (const entry of request.entries) {
        values.set(entry.key, `[${request.targetLocale}] ${entry.value}`);
        integrity.set(entry.key, PASS);
      }
      inFlight -= 1;
      return { values, integrity };
    },
  };
  return { provider, stats: () => ({ maxInFlight, arrived }) };
}

async function project(source: Record<string, unknown>): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  return dir;
}

function targetText(dir: string, locale: string): Promise<string> {
  return readTextFile(join(dir, "locales", `${locale}.json`));
}

const cfg = (
  targetLocales: readonly string[],
  overrides: Partial<VerbatraConfig> = {},
): VerbatraConfig => baseConfig({ targetLocales: [...targetLocales], ...overrides });

describe("translate: bounded locale-level concurrency", () => {
  it("runs no more than the configured limit of locales concurrently", async () => {
    const dir = await project({ a: "A" });
    const { provider, stats } = makeConcurrencyProbe({ gateAt: 2 });

    const summary = await translate(
      { config: cfg(["de", "fr", "es", "it"]), cwd: dir, concurrency: 2 },
      { createProvider: () => provider },
    );

    expect(summary.failed).toEqual([]);
    expect(stats().maxInFlight).toBeLessThanOrEqual(2);
    expect(stats().maxInFlight).toBe(2);
  });

  it("bounds in-flight calls to the limit when the limit is below the locale count", async () => {
    const dir = await project({ a: "A" });
    const { provider, stats } = makeConcurrencyProbe({ gateAt: 3 });

    const summary = await translate(
      { config: cfg(["de", "fr", "es", "it", "pt", "nl"]), cwd: dir, concurrency: 3 },
      { createProvider: () => provider },
    );

    expect(summary.failed).toEqual([]);
    expect(stats().maxInFlight).toBeLessThanOrEqual(3);
    expect(stats().maxInFlight).toBe(3);
  });

  it("runs strictly serially by default (concurrency unset), never overlapping provider calls", async () => {
    const dir = await project({ a: "A" });
    const { provider, stats } = makeConcurrencyProbe({ delayMs: 30 });

    const summary = await translate(
      { config: cfg(["de", "fr", "es", "it"]), cwd: dir },
      { createProvider: () => provider },
    );

    expect(summary.failed).toEqual([]);
    expect(stats().arrived).toBe(4);
    expect(stats().maxInFlight).toBe(1);
  });

  it("orders RunSummary.locales and written files by source order regardless of completion order", async () => {
    const targets = ["de", "fr", "es", "it"] as const;
    const source = { a: "A", b: "B" };

    const serialDir = await project(source);
    const serial = await translate(
      { config: cfg(targets), cwd: serialDir },
      { createProvider: () => makeStubProvider().provider },
    );

    const concurrentDir = await project(source);
    // Reverse the completion order: the first source locale finishes last.
    const delayByLocale = { de: 40, fr: 30, es: 20, it: 10 };
    const { provider } = makeConcurrencyProbe({ delayByLocale });
    const concurrent = await translate(
      { config: cfg(targets), cwd: concurrentDir, concurrency: 4 },
      { createProvider: () => provider },
    );

    expect(serial.locales.map((locale) => locale.locale)).toEqual([...targets]);
    expect(concurrent.locales.map((locale) => locale.locale)).toEqual([...targets]);
    expect(serial.failed).toEqual([]);
    expect(concurrent.failed).toEqual([]);

    for (const locale of targets) {
      expect(await targetText(concurrentDir, locale)).toEqual(await targetText(serialDir, locale));
    }
  });

  it("produces a byte-identical lock file across two default (serial) runs over the same fixture", async () => {
    const targets = ["de", "fr", "es"] as const;
    const source = { a: "A", b: "B" };

    const firstDir = await project(source);
    await translate(
      { config: cfg(targets), cwd: firstDir },
      { createProvider: () => makeStubProvider().provider },
    );

    const secondDir = await project(source);
    await translate(
      { config: cfg(targets), cwd: secondDir },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(await readTextFile(lockFilePath(secondDir))).toEqual(
      await readTextFile(lockFilePath(firstDir)),
    );
  });

  it("writes a lock file byte-identical to a serial run when locales complete in reverse order under concurrency", async () => {
    const targets = ["de", "fr", "es", "it"] as const;
    const source = { a: "A", b: "B" };

    const serialDir = await project(source);
    await translate(
      { config: cfg(targets), cwd: serialDir },
      { createProvider: () => makeStubProvider().provider },
    );

    const concurrentDir = await project(source);
    // Force completion order to be the reverse of source order, so a locale record built in
    // completion order would serialize with reversed keys. The write path's key sort must undo it.
    const delayByLocale = { de: 40, fr: 30, es: 20, it: 10 };
    const { provider } = makeConcurrencyProbe({ delayByLocale });
    await translate(
      { config: cfg(targets), cwd: concurrentDir, concurrency: 4 },
      { createProvider: () => provider },
    );

    expect(await readTextFile(lockFilePath(concurrentDir))).toEqual(
      await readTextFile(lockFilePath(serialDir)),
    );
  });

  it("refuses concurrency greater than 1 on a live budgeted run before constructing the provider", async () => {
    let providerConstructed = false;
    await expect(
      translate(
        { config: cfg(["de", "fr"], { maxTokens: 1000 }), cwd: "/nonexistent", concurrency: 2 },
        {
          createProvider: () => {
            providerConstructed = true;
            return makeStubProvider().provider;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "CONCURRENCY_BUDGET_CONFLICT" });
    expect(providerConstructed).toBe(false);
  });

  it("allows concurrency greater than 1 with a budget on a dry run", async () => {
    const dir = await project({ a: "A" });
    const summary = await translate({
      config: cfg(["de", "fr"], { maxTokens: 1000 }),
      cwd: dir,
      concurrency: 2,
      dryRun: true,
    });
    expect(summary.dryRun).toBe(true);
    expect(summary.locales.map((locale) => locale.locale)).toEqual(["de", "fr"]);
  });

  it("allows concurrency of exactly 1 with a budget on a live run", async () => {
    const dir = await project({ a: "A" });
    const summary = await translate(
      { config: cfg(["de"], { maxTokens: 1000 }), cwd: dir, concurrency: 1 },
      { createProvider: () => makeStubProvider().provider },
    );
    expect(summary.failed).toEqual([]);
  });

  it.each([
    0,
    -3,
    1.5,
    Number.NaN,
  ])("rejects a non-positive or non-integer concurrency (%s) with CONCURRENCY_INVALID", async (value) => {
    await expect(
      translate({ config: cfg(["de"]), cwd: "/nonexistent", concurrency: value, dryRun: true }),
    ).rejects.toMatchObject({ code: "CONCURRENCY_INVALID" });
  });

  it("throws a structured SdkError for an invalid concurrency, not a generic Error", async () => {
    await expect(
      translate({ config: cfg(["de"]), cwd: "/nonexistent", concurrency: 0, dryRun: true }),
    ).rejects.toBeInstanceOf(SdkError);
  });
});
