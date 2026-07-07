import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { VerbatraConfig } from "@verbatra/sdk";
import { LOCK_FILE_NAME } from "@verbatra/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RefreshEvent } from "../shared/sse-events.js";
import { baseStudioConfig } from "./test-support.js";
import type { CreateStudioWatcher, StudioWatcher } from "./types.js";
import { createProjectWatcher, defaultCreateStudioWatcher } from "./watcher.js";

const PROJECT_ROOT = "/proj";

/** Mirrors the sdk's own watch.test.ts watcherHarness, generalized to multiple createWatcher calls. */
function multiWatcherHarness() {
  const calls: { paths: readonly string[]; listener?: () => void; closed: boolean }[] = [];
  const createWatcher: CreateStudioWatcher = (paths): StudioWatcher => {
    const call: { paths: readonly string[]; listener?: () => void; closed: boolean } = {
      paths,
      closed: false,
    };
    calls.push(call);
    return {
      onChange: (listener) => {
        call.listener = listener;
      },
      close: async () => {
        call.closed = true;
      },
    };
  };
  return {
    createWatcher,
    calls,
    emit(index: number): void {
      calls[index]?.listener?.();
    },
  };
}

function collectRefresh(): { events: RefreshEvent[]; listener: (event: RefreshEvent) => void } {
  const events: RefreshEvent[] = [];
  return { events, listener: (event) => events.push(event) };
}

describe("createProjectWatcher: category wiring", () => {
  it("watches the source file, every target locale file, and the lock file as three separate calls", () => {
    const harness = multiWatcherHarness();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de", "fr"] });
    createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT },
      { createWatcher: harness.createWatcher },
    );
    expect(harness.calls).toHaveLength(3);
    expect(harness.calls[0]?.paths).toEqual([join(PROJECT_ROOT, "locales/en.json")]);
    expect(harness.calls[1]?.paths).toEqual([
      join(PROJECT_ROOT, "locales/de.json"),
      join(PROJECT_ROOT, "locales/fr.json"),
    ]);
    expect(harness.calls[2]?.paths).toEqual([join(PROJECT_ROOT, LOCK_FILE_NAME)]);
  });

  it("creates no targets watcher when no target locales are configured", () => {
    const harness = multiWatcherHarness();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: [] });
    createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT },
      { createWatcher: harness.createWatcher },
    );
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[0]?.paths).toEqual([join(PROJECT_ROOT, "locales/en.json")]);
    expect(harness.calls[1]?.paths).toEqual([join(PROJECT_ROOT, LOCK_FILE_NAME)]);
  });

  it("never emits a refresh event until a raw change is seen", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT },
      { createWatcher: harness.createWatcher },
    ).onRefresh(refresh.listener);
    expect(refresh.events).toEqual([]);
  });
});

describe("createProjectWatcher: debounce and coalescing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a burst of raw events on one category collapses into exactly one refresh after the debounce window", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher },
    ).onRefresh(refresh.listener);

    harness.emit(1); // targets
    harness.emit(1);
    harness.emit(1);
    expect(refresh.events).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(49);
    expect(refresh.events).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh.events).toHaveLength(1);
    expect(refresh.events[0]).toEqual({ reason: "targets", at: expect.any(String) });
  });

  it("simultaneous changes in two different categories raise two distinct, correctly tagged events", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher },
    ).onRefresh(refresh.listener);

    harness.emit(0); // source
    harness.emit(2); // lock
    await vi.advanceTimersByTimeAsync(50);

    expect(refresh.events).toHaveLength(2);
    expect(refresh.events.map((event) => event.reason).sort()).toEqual(["lock", "source"]);
  });

  it("a second burst after the first settles raises a second, independent refresh", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher },
    ).onRefresh(refresh.listener);

    harness.emit(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(refresh.events).toHaveLength(1);

    harness.emit(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(refresh.events).toHaveLength(2);
  });
});

describe("createProjectWatcher: close", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("close() clears every pending debounce timer and closes every underlying watcher", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const watcher = createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(0);
    await watcher.close();
    await vi.advanceTimersByTimeAsync(100);

    expect(refresh.events).toEqual([]);
    expect(harness.calls.every((call) => call.closed)).toBe(true);
  });
});

/** Waits for a real (not faked) amount of wall-clock time; used only by the real-chokidar tests below. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("defaultCreateStudioWatcher: real chokidar behavior", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "verbatra-studio-watcher-"));
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "locales", "en.json"), JSON.stringify({ greeting: "hello" }));
    // Let the fixture write itself settle before a watcher attaches: a native fs watcher started
    // immediately after a write can otherwise observe that same write as a spurious first event,
    // despite `ignoreInitial`, on some platforms.
    await wait(300);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("a target file created after startup (parent directory already present) raises exactly one targets refresh", async () => {
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const refresh = collectRefresh();
    const watcher = createProjectWatcher(
      { config, projectRoot: root, debounceMs: 50 },
      { createWatcher: defaultCreateStudioWatcher },
    );
    watcher.onRefresh(refresh.listener);

    // The target file does not exist yet; only its parent directory ("locales/") does.
    await wait(200);
    await writeFile(join(root, "locales", "de.json"), JSON.stringify({ greeting: "hallo" }));
    await wait(600);

    expect(refresh.events).toEqual([{ reason: "targets", at: expect.any(String) }]);
    await watcher.close();
  }, 5000);

  it("a real atomic temp-write-then-rename over the lock file raises exactly one lock refresh", async () => {
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const refresh = collectRefresh();
    const watcher = createProjectWatcher(
      { config, projectRoot: root, debounceMs: 50 },
      { createWatcher: defaultCreateStudioWatcher },
    );
    watcher.onRefresh(refresh.listener);
    await wait(200);

    const lockPath = join(root, LOCK_FILE_NAME);
    const tempPath = join(dirname(lockPath), ".verbatra.lock.json.tmp-probe");
    await writeFile(tempPath, JSON.stringify({ version: 1, locales: {} }));
    await rename(tempPath, lockPath);
    await wait(600);

    expect(refresh.events).toEqual([{ reason: "lock", at: expect.any(String) }]);
    await watcher.close();
  }, 5000);

  it("temp-file churn (the intermediate temp file appearing and disappearing) never itself raises an event", async () => {
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: [] });
    const refresh = collectRefresh();
    const watcher = createProjectWatcher(
      { config, projectRoot: root, debounceMs: 50 },
      { createWatcher: defaultCreateStudioWatcher },
    );
    watcher.onRefresh(refresh.listener);
    await wait(200);

    const lockPath = join(root, LOCK_FILE_NAME);
    const tempPath = join(dirname(lockPath), ".verbatra.lock.json.tmp-churn");
    // Write and remove the temp sibling without ever renaming it over the watched lock path.
    await writeFile(tempPath, JSON.stringify({ version: 1, locales: {} }));
    await rm(tempPath, { force: true });
    await wait(600);

    expect(refresh.events).toEqual([]);
    await watcher.close();
  }, 5000);
});
