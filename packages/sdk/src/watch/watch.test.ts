import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SdkError } from "../errors.js";
import type { RunSummary } from "../flow/summary.js";
import type { TranslateInput } from "../flow/translate-project.js";
import { baseConfig, makeFakeFs } from "../test-support.js";
import { type CreateWatcher, type RunTranslate, type WatchRunResult, watch } from "./watch.js";

const CWD = "/proj";
const SOURCE = resolve(CWD, "locales/en.json");

const okFs = makeFakeFs({ fileExists: async () => true });

/** Flush nested microtasks (run-completion chain) without advancing the debounce timer. */
async function settle(): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    await Promise.resolve();
  }
}

function watcherHarness() {
  let listener: (() => void) | undefined;
  let capturedPaths: readonly string[] = [];
  let closed = false;
  const createWatcher: CreateWatcher = (paths) => {
    capturedPaths = paths;
    return {
      onChange: (l) => {
        listener = l;
      },
      close: async () => {
        closed = true;
      },
    };
  };
  return {
    createWatcher,
    emit: () => listener?.(),
    get paths() {
      return capturedPaths;
    },
    get closed() {
      return closed;
    },
  };
}

function runHarness() {
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const inputs: TranslateInput[] = [];
  const summary: RunSummary = { dryRun: false, locales: [], succeeded: [], failed: [] };
  let blocker: Promise<void> | undefined;
  let releaseFn: (() => void) | undefined;
  let nextThrow: unknown;
  const run: RunTranslate = async (input) => {
    calls += 1;
    inputs.push(input);
    active += 1;
    maxActive = Math.max(maxActive, active);
    const held = blocker;
    try {
      if (held !== undefined) {
        await held;
      }
      if (nextThrow !== undefined) {
        const toThrow = nextThrow;
        nextThrow = undefined;
        throw toThrow;
      }
      return summary;
    } finally {
      active -= 1;
    }
  };
  return {
    run,
    summary,
    inputs,
    block: () => {
      blocker = new Promise<void>((r) => {
        releaseFn = r;
      });
    },
    release: () => {
      const r = releaseFn;
      blocker = undefined;
      releaseFn = undefined;
      r?.();
    },
    throwNext: (error: unknown) => {
      nextThrow = error;
    },
    get calls() {
      return calls;
    },
    get maxActive() {
      return maxActive;
    },
  };
}

describe("watch: startup and wiring", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("watches ONLY the configured source path, not targets or a broad tree", async () => {
    const w = watcherHarness();
    const r = runHarness();
    await watch(
      { config: baseConfig({ targetLocales: ["de", "fr"] }), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    expect(w.paths).toEqual([SOURCE]);
  });

  it("performs exactly one initial run on startup, before any event", async () => {
    const w = watcherHarness();
    const r = runHarness();
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    expect(r.calls).toBe(1);
  });

  it("invokes the one-shot translate with the config and cwd, never dry-run", async () => {
    const w = watcherHarness();
    const r = runHarness();
    const config = baseConfig();
    await watch(
      { config, cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle();
    expect(r.inputs[0]).toEqual({ config, cwd: CWD });
    expect((r.inputs[0] as { dryRun?: boolean }).dryRun).toBeUndefined();
  });

  it("a missing source path at startup is a hard SOURCE_UNREADABLE error, no watcher or run", async () => {
    const w = watcherHarness();
    const r = runHarness();
    const missingFs = makeFakeFs({ fileExists: async () => false });
    await expect(
      watch(
        { config: baseConfig(), cwd: CWD, onRun: () => {} },
        { fs: missingFs, createWatcher: w.createWatcher, runTranslate: r.run },
      ),
    ).rejects.toMatchObject({ code: "SOURCE_UNREADABLE" });
    expect(r.calls).toBe(0);
    expect(w.paths).toEqual([]);
  });

  it("surfaces each run's summary through onRun, not swallowed", async () => {
    const w = watcherHarness();
    const r = runHarness();
    const results: WatchRunResult[] = [];
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: (x) => results.push(x) },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle();
    expect(results[0]).toEqual({ status: "succeeded", summary: r.summary });
  });
});

describe("watch: debounce + serialization state machine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defaults cwd to process.cwd() when none is given", async () => {
    const w = watcherHarness();
    const r = runHarness();
    await watch(
      { config: baseConfig(), onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    expect(w.paths).toEqual([resolve(process.cwd(), "locales/en.json")]);
  });

  it("honors a custom debounceMs interval", async () => {
    const w = watcherHarness();
    const r = runHarness();
    await watch(
      { config: baseConfig(), cwd: CWD, debounceMs: 50, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle();
    w.emit();
    await vi.advanceTimersByTimeAsync(49);
    expect(r.calls).toBe(1); // not yet settled at the custom interval
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(r.calls).toBe(2); // settled at 50ms
  });

  it("a burst of events triggers exactly ONE run after the debounce window", async () => {
    const w = watcherHarness();
    const r = runHarness();
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle(); // initial run completes -> idle
    w.emit();
    w.emit();
    w.emit();
    expect(r.calls).toBe(1); // still only the initial run; debounce pending
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(r.calls).toBe(2); // one run for the whole burst
  });

  it("a change DURING a run does not start a concurrent run; exactly one follow-up after", async () => {
    const w = watcherHarness();
    const r = runHarness();
    r.block();
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle(); // initial run is in flight (held)
    w.emit();
    await vi.advanceTimersByTimeAsync(300); // settled change during RUNNING -> pending
    expect(r.calls).toBe(1); // no concurrent run
    r.release();
    await settle();
    expect(r.calls).toBe(2); // exactly one follow-up
    expect(r.maxActive).toBe(1); // never two in flight
  });

  it("MANY changes during a run collapse into a single follow-up", async () => {
    const w = watcherHarness();
    const r = runHarness();
    r.block();
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle();
    for (let i = 0; i < 5; i += 1) {
      w.emit();
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(r.calls).toBe(1);
    r.release();
    await settle();
    expect(r.calls).toBe(2); // one follow-up, not five
    expect(r.maxActive).toBe(1);
  });

  it("the follow-up starts IMMEDIATELY on completion with no added debounce delay", async () => {
    const w = watcherHarness();
    const r = runHarness();
    r.block();
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle();
    w.emit();
    await vi.advanceTimersByTimeAsync(300); // pending set
    r.release();
    await settle(); // microtasks only, NO timer advance
    expect(r.calls).toBe(2); // the follow-up ran without any debounce wait
  });

  it("a debounce timer pending when the run completes fires against the idle machine: one run, not dropped or doubled", async () => {
    const w = watcherHarness();
    const r = runHarness();
    r.block();
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle(); // initial run held in flight
    w.emit(); // raw event -> debounce timer started, NOT advanced past the window
    expect(r.calls).toBe(1);
    r.release();
    await settle(); // initial completes; pending is false (timer not fired) -> idle
    expect(r.calls).toBe(1); // the still-pending timer has not fired, no premature run
    await vi.advanceTimersByTimeAsync(300); // timer fires against the now-idle machine
    await settle();
    expect(r.calls).toBe(2); // exactly one run from the edit; not dropped, not doubled
    expect(r.maxActive).toBe(1);
  });
});

describe("watch: failure handling and shutdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a failing run is reported and watching CONTINUES (SdkError code surfaced)", async () => {
    const w = watcherHarness();
    const r = runHarness();
    const results: WatchRunResult[] = [];
    r.throwNext(new SdkError("SOURCE_INVALID", "bad source"));
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: (x) => results.push(x) },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle();
    expect(results[0]).toEqual({
      status: "failed",
      error: { code: "SOURCE_INVALID", message: "bad source" },
    });
    // watcher is still alive: the next change triggers another run
    w.emit();
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(r.calls).toBe(2);
    expect(results[1]?.status).toBe("succeeded");
  });

  it("a non-coded Error and a non-Error throw both surface a fallback code", async () => {
    const w = watcherHarness();
    const r = runHarness();
    const results: WatchRunResult[] = [];
    r.throwNext(new Error("boom"));
    await watch(
      { config: baseConfig(), cwd: CWD, onRun: (x) => results.push(x) },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle();
    expect(results[0]).toEqual({
      status: "failed",
      error: { code: "WATCH_RUN_FAILED", message: "boom" },
    });
    r.throwNext("weird");
    w.emit();
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(results[1]).toEqual({
      status: "failed",
      error: { code: "WATCH_RUN_FAILED", message: "weird" },
    });
  });

  it("stop() during a run: no new triggers, no follow-up, awaits the in-flight run, closes the watcher", async () => {
    const w = watcherHarness();
    const r = runHarness();
    r.block();
    const controller = await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle(); // initial run in flight
    w.emit();
    await vi.advanceTimersByTimeAsync(300); // pending set during the run

    const stopped = controller.stop();
    // events after stop() are ignored
    w.emit();
    await vi.advanceTimersByTimeAsync(300);
    r.release(); // let the in-flight run finish
    await stopped;

    expect(r.calls).toBe(1); // the pending follow-up was discarded; post-stop event ignored
    expect(w.closed).toBe(true);
  });

  it("stop() while a debounce timer is pending clears it: the edit triggers no run", async () => {
    const w = watcherHarness();
    const r = runHarness();
    const controller = await watch(
      { config: baseConfig(), cwd: CWD, onRun: () => {} },
      { fs: okFs, createWatcher: w.createWatcher, runTranslate: r.run },
    );
    await settle(); // initial run done -> idle
    w.emit(); // raw event -> debounce timer pending (not advanced)
    await controller.stop(); // stop clears the pending timer
    await vi.advanceTimersByTimeAsync(300); // timer was cleared -> nothing fires
    await settle();
    expect(r.calls).toBe(1); // only the initial run; the pending edit produced no run after stop
    expect(w.closed).toBe(true);
  });
});
