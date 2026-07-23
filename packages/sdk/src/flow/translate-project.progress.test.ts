import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { localeLockPath } from "../lock/locale-write-lock.js";
import type { ProgressEvent } from "../progress/types.js";
import { baseConfig, makeStubProvider, makeTempDir, writeJsonFile } from "../test-support.js";
import type { LocaleSummary } from "./summary.js";
import { translate } from "./translate-project.js";

/** Pre-create a held locale lock so a live run's own acquire contends and fails with LOCK_CONTENDED. */
async function holdLock(dir: string, locale: string): Promise<void> {
  const path = localeLockPath(dir, locale);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({ pid: 9999, acquiredAt: "2026-07-18T00:00:00.000Z" }),
    "utf8",
  );
}

/** Find one locale's summary by tag, failing loudly if it is absent. */
function localeSummary(summaries: readonly LocaleSummary[], locale: string): LocaleSummary {
  const summary = summaries.find((entry) => entry.locale === locale);
  if (summary === undefined) {
    throw new Error(`no summary for locale ${locale}`);
  }
  return summary;
}

/** A temp project whose source carries `keyCount` keys and no target files yet (all keys missing). */
async function makeProject(keyCount: number): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  const source: Record<string, string> = {};
  for (let index = 0; index < keyCount; index += 1) {
    source[`k${index}`] = `value ${index}`;
  }
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  return dir;
}

describe("translate: onProgress emits locale, sub-batch, and run events on the live path", () => {
  it("fires a started/finished event per locale, a sub-batch per batch, and one run-finished", async () => {
    const dir = await makeProject(3);
    const config = baseConfig({ targetLocales: ["de", "fr"], maxBatchSize: 2 });
    const { provider } = makeStubProvider();
    const events: ProgressEvent[] = [];

    await translate(
      { config, cwd: dir, onProgress: (event) => events.push(event) },
      { createProvider: () => provider },
    );

    expect(events).toEqual([
      { type: "locale-started", locale: "de", localeIndex: 0, totalLocales: 2 },
      { type: "sub-batch", locale: "de", batchIndex: 1, totalBatches: 2 },
      { type: "sub-batch", locale: "de", batchIndex: 2, totalBatches: 2 },
      { type: "locale-finished", locale: "de", translated: 3 },
      { type: "locale-started", locale: "fr", localeIndex: 1, totalLocales: 2 },
      { type: "sub-batch", locale: "fr", batchIndex: 1, totalBatches: 2 },
      { type: "sub-batch", locale: "fr", batchIndex: 2, totalBatches: 2 },
      { type: "locale-finished", locale: "fr", translated: 3 },
      { type: "run-finished", localesCompleted: 2 },
    ]);
  });

  it("does not construct a provider or emit a sub-batch event on a dry-run", async () => {
    const dir = await makeProject(3);
    const config = baseConfig({ targetLocales: ["de"], maxBatchSize: 2 });
    const createProvider = vi.fn(() => makeStubProvider().provider);
    const events: ProgressEvent[] = [];

    await translate(
      { config, cwd: dir, dryRun: true, onProgress: (event) => events.push(event) },
      { createProvider },
    );

    expect(createProvider).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === "sub-batch")).toBe(false);
    // A dry-run reports the keys it would translate, so locale-finished still carries that count.
    expect(events).toEqual([
      { type: "locale-started", locale: "de", localeIndex: 0, totalLocales: 1 },
      { type: "locale-finished", locale: "de", translated: 3 },
      { type: "run-finished", localesCompleted: 1 },
    ]);
  });

  it("counts a failed (isolated, not thrown) locale in run-finished and fires its locale-finished with 0", async () => {
    const dir = await makeProject(1);
    // "de" is locked so its live acquire times out (LOCK_CONTENDED), isolated as a failed summary;
    // "fr" is free and succeeds. Both must still be counted and both must emit locale-finished.
    await holdLock(dir, "de");
    const config = baseConfig({ targetLocales: ["de", "fr"] });
    const { provider } = makeStubProvider();
    const events: ProgressEvent[] = [];

    const summary = await translate(
      { config, cwd: dir, lockAcquireTimeoutMs: 20, onProgress: (event) => events.push(event) },
      { createProvider: () => provider },
    );

    expect(localeSummary(summary.locales, "de").status).toBe("failed");
    expect(events).toContainEqual({ type: "locale-finished", locale: "de", translated: 0 });
    expect(events).toContainEqual({ type: "run-finished", localesCompleted: 2 });
  });

  it("runs with no onProgress listener without error", async () => {
    const dir = await makeProject(1);
    const config = baseConfig({ targetLocales: ["de"] });
    const { provider } = makeStubProvider();

    const summary = await translate({ config, cwd: dir }, { createProvider: () => provider });

    expect(summary.succeeded).toEqual(["de"]);
  });
});
