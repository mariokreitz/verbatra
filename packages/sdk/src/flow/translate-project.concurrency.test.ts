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

/**
 * A provider that records every call (with a global, ever-incrementing index so a duplicate call
 * for the same locale/key is distinguishable from the first, not merely counted) and delays each
 * response, widening the window in which a second, concurrent `translate()` call can perform its
 * own initial reads before the first call's write ever lands. The delay is a generous safety
 * margin over the local, in-process reads/writes both calls otherwise perform (source read, lock
 * read, target write), not a source of flakiness: see the describe block's own doc comment below
 * for why the ordering this test depends on holds regardless of exact timing.
 */
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

/**
 * Proves the lock-read relocation (criterion 7 of the write-half addendum): two `translate()`
 * calls fired concurrently, sharing the same real on-disk project and the real default file
 * system, must never both pay for the same already-translated-but-now-stale key, and the file
 * each locale ends up with must be exactly whichever call's write actually won the race, not a
 * corrupted mix.
 *
 * The fixture seeds a key that is already translated and lock-recorded (a "changed" key once the
 * source is edited), not a brand-new "missing" key: a missing key's own `diffResources` staleness
 * check re-reads the target file fresh inside `runLocale` regardless of which baseline snapshot a
 * caller diffed against, which accidentally protects that one narrow case even in the unfixed
 * code (see the write-half addendum's own architecture notes on this). A "changed" key's
 * staleness is decided purely by comparing the source's current content hash against the lock's
 * recorded hash, which is exactly the value this test's race is about: whichever call's baseline
 * snapshot is stale keeps believing the key needs retranslating, independent of what the other
 * call already wrote to the target file.
 *
 * Why this is a proof by construction, not timing luck: both calls perform the exact same
 * sequence of awaits up to the point they attempt to acquire a given locale's write lock (read
 * source, in the old code also read the lock file, before either call has written anything).
 * Whichever call loses that lock's real, OS-level exclusive-create race blocks in a poll loop
 * (`withLocaleWriteLock`'s default 100ms interval) while the winner's own critical section runs;
 * the winner's critical section is dominated by this provider's `delayMs` (well under the loser's
 * poll interval), so the winner always finishes and releases before the loser's first retry. In
 * the pre-fix code, the loser's diff baseline was captured once, before either call attempted any
 * lock, so it stays the pre-edit hash regardless of what the winner later wrote; in the fixed
 * code, the loser re-reads the lock file only after it holds the lock, which is only after the
 * winner already released it, so it always sees the winner's post-edit hash.
 */
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
