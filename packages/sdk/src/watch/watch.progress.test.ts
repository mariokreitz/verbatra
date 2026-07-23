import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProgressEvent } from "../progress/types.js";
import { baseConfig, makeStubProvider, makeTempDir, writeJsonFile } from "../test-support.js";
import { type CreateWatcher, watch } from "./watch.js";

/** A watcher stub that never fires: the test exercises only the initial run's progress. */
const inertWatcher: CreateWatcher = () => ({
  onChange: () => {},
  close: async () => {},
});

describe("watch: onProgress threads into each run and reaches the sub-batch loop", () => {
  it("emits real locale and sub-batch events from the initial run", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    await writeJsonFile(join(dir, "locales", "en.json"), { a: "1", b: "2", c: "3" });
    const config = baseConfig({ targetLocales: ["de"], maxBatchSize: 2 });
    const { provider } = makeStubProvider();
    const events: ProgressEvent[] = [];

    const controller = await watch(
      { config, cwd: dir, onRun: () => {}, onProgress: (event) => events.push(event) },
      { createWatcher: inertWatcher, createProvider: () => provider },
    );
    await controller.stop();

    expect(events).toEqual([
      { type: "locale-started", locale: "de", localeIndex: 0, totalLocales: 1 },
      { type: "sub-batch", locale: "de", batchIndex: 1, totalBatches: 2 },
      { type: "sub-batch", locale: "de", batchIndex: 2, totalBatches: 2 },
      { type: "locale-finished", locale: "de", translated: 3 },
      { type: "run-finished", localesCompleted: 1 },
    ]);
  });
});
