import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { LocaleFileSnapshot, SdkFs, VerbatraConfig } from "@verbatra/sdk";
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

function snapshot(
  locale: string,
  entries: Readonly<Record<string, string>> = {},
): LocaleFileSnapshot {
  return { locale, hashes: new Map(Object.entries(entries)) };
}

/** A readLocaleSnapshot fake that always reads as an empty file; for tests that only care about wiring, not delta content. */
function emptyReadLocaleSnapshot(locale: string): Promise<LocaleFileSnapshot> {
  return Promise.resolve(snapshot(locale));
}

/**
 * Flushes pending microtasks (the async settle chain: readSnapshot, diff, and the trigger's own
 * `.then(emit)`) without advancing the debounce timer. Mirrors the sdk's own watch.test.ts settle().
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    await Promise.resolve();
  }
}

/**
 * Builds a readLocaleSnapshot fake that returns each locale's queued snapshots in call order: the
 * first call for a locale (the startup priming read) gets that locale's first entry, and each later
 * call (one per settled change) gets the next queued entry. The last entry repeats once exhausted.
 */
function sequencedReadLocaleSnapshot(
  sequences: Readonly<Record<string, readonly LocaleFileSnapshot[]>>,
): (locale: string) => Promise<LocaleFileSnapshot> {
  const cursors = new Map<string, number>();
  return async (locale) => {
    const sequence = sequences[locale] ?? [];
    const index = cursors.get(locale) ?? 0;
    cursors.set(locale, index + 1);
    const next = sequence[Math.min(index, sequence.length - 1)];
    if (next === undefined) {
      throw new Error(`no snapshot configured for locale "${locale}"`);
    }
    return next;
  };
}

describe("createProjectWatcher: category wiring", () => {
  it("watches the source file, every target locale file as its own call, and the lock file", async () => {
    const harness = multiWatcherHarness();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de", "fr"] });
    await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    expect(harness.calls).toHaveLength(4);
    expect(harness.calls[0]?.paths).toEqual([join(PROJECT_ROOT, "locales/en.json")]);
    expect(harness.calls[1]?.paths).toEqual([join(PROJECT_ROOT, "locales/de.json")]);
    expect(harness.calls[2]?.paths).toEqual([join(PROJECT_ROOT, "locales/fr.json")]);
    expect(harness.calls[3]?.paths).toEqual([join(PROJECT_ROOT, LOCK_FILE_NAME)]);
  });

  it("creates no targets watcher when no target locales are configured", async () => {
    const harness = multiWatcherHarness();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: [] });
    await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[0]?.paths).toEqual([join(PROJECT_ROOT, "locales/en.json")]);
    expect(harness.calls[1]?.paths).toEqual([join(PROJECT_ROOT, LOCK_FILE_NAME)]);
  });

  it("never emits a refresh event until a raw change is seen", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);
    expect(refresh.events).toEqual([]);
  });
});

describe("createProjectWatcher: debounce and coalescing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a burst of raw events on one locale collapses into exactly one refresh after the debounce window", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1); // de (targets)
    harness.emit(1);
    harness.emit(1);
    expect(refresh.events).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(49);
    expect(refresh.events).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    expect(refresh.events).toHaveLength(1);
    expect(refresh.events[0]).toEqual({
      reason: "targets",
      at: expect.any(String),
      locale: "de",
      delta: { added: 0, changed: 0, removed: 0 },
    });
  });

  it("simultaneous changes in two different categories raise two distinct, correctly tagged events", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(0); // source
    harness.emit(2); // lock
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toHaveLength(2);
    expect(refresh.events.map((event) => event.reason).sort()).toEqual(["lock", "source"]);
    const lockEvent = refresh.events.find((event) => event.reason === "lock");
    expect(lockEvent).toEqual({ reason: "lock", at: expect.any(String) });
  });

  it("a second burst after the first settles raises a second, independent refresh", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(0);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();
    expect(refresh.events).toHaveLength(1);

    harness.emit(0);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();
    expect(refresh.events).toHaveLength(2);
  });
});

describe("createProjectWatcher: per-locale key delta", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports a newly added key in a single target locale as a nonzero added count", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en")],
      de: [snapshot("de", { a: "h1" }), snapshot("de", { a: "h1", b: "h2" })],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toEqual([
      {
        reason: "targets",
        at: expect.any(String),
        locale: "de",
        delta: { added: 1, changed: 0, removed: 0 },
      },
    ]);
  });

  it("reports a removed key in a single target locale as a nonzero removed count", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en")],
      de: [snapshot("de", { a: "h1", b: "h2" }), snapshot("de", { a: "h1" })],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toEqual([
      {
        reason: "targets",
        at: expect.any(String),
        locale: "de",
        delta: { added: 0, changed: 0, removed: 1 },
      },
    ]);
  });

  it("reports a value-only edit on an existing key as a nonzero changed count, not a no-op delta", async () => {
    // The key itself is untouched; only its value changes. This is the case the ticket's semantics
    // decision exists to fix: a source-drift-based delta would report nothing here.
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en")],
      de: [snapshot("de", { a: "h1" }), snapshot("de", { a: "h1-edited" })],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toEqual([
      {
        reason: "targets",
        at: expect.any(String),
        locale: "de",
        delta: { added: 0, changed: 1, removed: 0 },
      },
    ]);
  });

  it("two different target locales changing within the same debounce window report separate, correctly attributed counts", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de", "fr"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en")],
      de: [snapshot("de", { a: "h1" }), snapshot("de", { a: "h1", b: "h2" })],
      fr: [snapshot("fr", { x: "h1", y: "h2" }), snapshot("fr", { x: "h1" })],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1); // de
    harness.emit(2); // fr
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toHaveLength(2);
    const de = refresh.events.find((event) => event.locale === "de");
    const fr = refresh.events.find((event) => event.locale === "fr");
    expect(de).toEqual({
      reason: "targets",
      at: expect.any(String),
      locale: "de",
      delta: { added: 1, changed: 0, removed: 0 },
    });
    expect(fr).toEqual({
      reason: "targets",
      at: expect.any(String),
      locale: "fr",
      delta: { added: 0, changed: 0, removed: 1 },
    });
  });

  it("reports the source file's own delta, tagged reason source, with no derived per-target drift", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en", { greeting: "h1" }), snapshot("en", { greeting: "h1", farewell: "h2" })],
      de: [snapshot("de")],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(0); // source
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toEqual([
      {
        reason: "source",
        at: expect.any(String),
        locale: "en",
        delta: { added: 1, changed: 0, removed: 0 },
      },
    ]);
  });

  it("a lock-file change stays a bare { reason, at } event: no locale or delta field at all", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(2); // lock
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toHaveLength(1);
    expect(refresh.events[0]).toEqual({ reason: "lock", at: expect.any(String) });
    expect(Object.keys(refresh.events[0] as RefreshEvent).sort()).toEqual(["at", "reason"]);
  });

  it("a change that produces no net content delta still emits an event, with all counts zero rather than being omitted", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en")],
      de: [snapshot("de", { a: "h1" }), snapshot("de", { a: "h1" })],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toEqual([
      {
        reason: "targets",
        at: expect.any(String),
        locale: "de",
        delta: { added: 0, changed: 0, removed: 0 },
      },
    ]);
  });

  it("the first change after startup is diffed against the snapshot taken at startup, not an absent baseline", async () => {
    // The startup snapshot already has real content (two keys). If the baseline were wrongly
    // treated as empty or absent, this edit would misreport as "2 added" instead of "1 changed".
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en")],
      de: [snapshot("de", { a: "h1", b: "h2" }), snapshot("de", { a: "h1", b: "h2-edited" })],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toEqual([
      {
        reason: "targets",
        at: expect.any(String),
        locale: "de",
        delta: { added: 0, changed: 1, removed: 0 },
      },
    ]);
  });

  it("a real emitted event never carries a field beyond reason, at, locale, and numeric delta counts", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const readLocaleSnapshot = sequencedReadLocaleSnapshot({
      en: [snapshot("en")],
      de: [snapshot("de", { a: "h1" }), snapshot("de", { a: "h1", b: "h2" })],
    });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    const event = refresh.events[0] as RefreshEvent;
    expect(Object.keys(event).sort()).toEqual(["at", "delta", "locale", "reason"]);
    expect(typeof event.locale).toBe("string");
    const delta = event.delta as NonNullable<RefreshEvent["delta"]>;
    expect(Object.keys(delta).sort()).toEqual(["added", "changed", "removed"]);
    for (const value of Object.values(delta)) {
      expect(typeof value).toBe("number");
    }
  });
});

describe("createProjectWatcher: same-locale settle race (criterion 12)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("two rapid changes to the same locale settle in trigger order, never stomping the baseline out of order", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });

    const s0 = snapshot("de", { a: "h1" });
    const s1 = snapshot("de", { a: "h1", b: "h2" });
    const s2 = snapshot("de", { a: "h1", b: "h2", c: "h3" });

    // Counted per locale: the source ("en") priming call must not consume a slot meant for "de",
    // or the second ("de") priming call would itself hit the gate below and hang forever.
    const calls: string[] = [];
    let releaseFirstSettleRead: (() => void) | undefined;
    let deCallIndex = 0;
    const readLocaleSnapshot = async (locale: string): Promise<LocaleFileSnapshot> => {
      calls.push(locale);
      if (locale !== "de") {
        return snapshot(locale);
      }
      deCallIndex += 1;
      if (deCallIndex === 1) {
        return s0; // priming
      }
      if (deCallIndex === 2) {
        // The first settle's read: held open until the test explicitly releases it, simulating a
        // slow disk read still in flight when the second change's debounce window fires.
        await new Promise<void>((resolveGate) => {
          releaseFirstSettleRead = resolveGate;
        });
        return s1;
      }
      return s2;
    };

    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);
    // Priming reads happen for source ("en") and the one target locale ("de"); the lock entry has
    // no tracker and is never read.
    expect(calls).toEqual(["en", "de"]);

    harness.emit(1); // de: edit 1
    await vi.advanceTimersByTimeAsync(50); // first settle's debounce fires and starts its (held) read
    await flushMicrotasks();
    expect(calls).toEqual(["en", "de", "de"]);
    expect(refresh.events).toEqual([]);

    harness.emit(1); // de: edit 2, while the first settle's read is still in flight
    await vi.advanceTimersByTimeAsync(50); // second settle's debounce fires
    await flushMicrotasks();
    // The second settle must not have started its own read yet: it is queued behind the first
    // settle's still-unresolved attempt, not racing it.
    expect(calls).toEqual(["en", "de", "de"]);
    expect(refresh.events).toEqual([]);

    releaseFirstSettleRead?.();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(calls).toEqual(["en", "de", "de", "de"]);
    expect(refresh.events).toHaveLength(2);
    // b is new relative to s0: the first settle's delta.
    expect(refresh.events[0]).toEqual({
      reason: "targets",
      at: expect.any(String),
      locale: "de",
      delta: { added: 1, changed: 0, removed: 0 },
    });
    // c is new relative to s1 (only c, since b is already present in s1): proves the second settle
    // diffed against the freshly updated baseline, not the stale s0 (which would report added: 2).
    expect(refresh.events[1]).toEqual({
      reason: "targets",
      at: expect.any(String),
      locale: "de",
      delta: { added: 1, changed: 0, removed: 0 },
    });

    await watcher.close();
  });
});

describe("createProjectWatcher: settle failure fallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a settle that fails to read falls back to the bare { reason, at } event and leaves the baseline untouched", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });

    // Counted per locale: the source ("en") priming call must not consume a "de" call slot.
    let deCall = 0;
    const readLocaleSnapshot = async (locale: string): Promise<LocaleFileSnapshot> => {
      if (locale !== "de") {
        return snapshot(locale);
      }
      deCall += 1;
      if (deCall === 1) {
        return snapshot("de", { a: "h1" }); // priming
      }
      if (deCall === 2) {
        throw new Error("simulated transient read failure");
      }
      return snapshot("de", { a: "h1", b: "h2" });
    };

    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1); // de: the failing settle
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toHaveLength(1);
    expect(refresh.events[0]).toEqual({ reason: "targets", at: expect.any(String) });
    expect(Object.keys(refresh.events[0] as RefreshEvent).sort()).toEqual(["at", "reason"]);

    // A later, successful settle still diffs against the ORIGINAL baseline ({a: "h1"}), proving the
    // failed attempt never corrupted the stored snapshot.
    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(refresh.events).toHaveLength(2);
    expect(refresh.events[1]).toEqual({
      reason: "targets",
      at: expect.any(String),
      locale: "de",
      delta: { added: 1, changed: 0, removed: 0 },
    });
  });

  it("a startup priming read that fails falls back to an empty baseline instead of preventing the watcher from starting", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });

    let dePrimed = false;
    const readLocaleSnapshot = async (locale: string): Promise<LocaleFileSnapshot> => {
      if (locale === "de" && !dePrimed) {
        dePrimed = true;
        throw new Error("simulated malformed file already on disk at startup");
      }
      return locale === "de" ? snapshot("de", { a: "h1" }) : snapshot(locale);
    };

    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(1);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    // Diffed against the empty fallback baseline, so the one real key reads as added.
    expect(refresh.events).toEqual([
      {
        reason: "targets",
        at: expect.any(String),
        locale: "de",
        delta: { added: 1, changed: 0, removed: 0 },
      },
    ]);
  });
});

describe("createProjectWatcher: default read wiring", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("threads an injected deps.fs into the default (non-injected) snapshot read", async () => {
    const root = await mkdtemp(join(tmpdir(), "verbatra-studio-watcher-fs-"));
    try {
      await mkdir(join(root, "locales"), { recursive: true });
      await writeFile(join(root, "locales", "en.json"), JSON.stringify({ greeting: "hello" }));

      // Reports every path as missing, even though a real source file exists on disk: proves the
      // default read wiring genuinely consults deps.fs rather than the sdk's real file system.
      const fs: SdkFs = {
        fileExists: async () => false,
        readFileBounded: async () => ({ kind: "missing" }),
        readBytesBounded: async () => ({ kind: "missing" }),
        writeFile: async () => {},
        writeBytes: async () => {},
        createExclusive: async () => true,
        deleteFile: async () => {},
      };

      const harness = multiWatcherHarness();
      const refresh = collectRefresh();
      const config: VerbatraConfig = baseStudioConfig({ targetLocales: [] });
      const watcher = await createProjectWatcher(
        { config, projectRoot: root, debounceMs: 50 },
        { createWatcher: harness.createWatcher, fs },
      );
      watcher.onRefresh(refresh.listener);

      // A real, on-disk edit after the watcher started: if deps.fs were NOT actually consulted (a
      // bug reverting to the sdk's real file system), the startup snapshot would have seen the
      // original "greeting" key and this edit would report a nonzero added count. Since deps.fs
      // reports every path as missing, both the startup snapshot and this settle stay empty, so the
      // edit is invisible: that is the discriminating, observable proof the override is honored.
      await writeFile(
        join(root, "locales", "en.json"),
        JSON.stringify({ greeting: "hello", farewell: "bye" }),
      );

      harness.emit(0); // source
      await vi.advanceTimersByTimeAsync(50);
      await flushMicrotasks();

      expect(refresh.events).toEqual([
        {
          reason: "source",
          at: expect.any(String),
          locale: "en",
          delta: { added: 0, changed: 0, removed: 0 },
        },
      ]);
      await watcher.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("createProjectWatcher: close", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("close() clears every pending debounce timer and closes every dynamically-sized underlying watcher", async () => {
    const harness = multiWatcherHarness();
    const refresh = collectRefresh();
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de", "fr"] });
    const watcher = await createProjectWatcher(
      { config, projectRoot: PROJECT_ROOT, debounceMs: 50 },
      { createWatcher: harness.createWatcher, readLocaleSnapshot: emptyReadLocaleSnapshot },
    );
    watcher.onRefresh(refresh.listener);

    harness.emit(0);
    harness.emit(1);
    harness.emit(2);
    await watcher.close();
    await vi.advanceTimersByTimeAsync(100);
    await flushMicrotasks();

    expect(refresh.events).toEqual([]);
    expect(harness.calls).toHaveLength(4);
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

  it("a target file created after startup (parent directory already present) raises a targets refresh with its added-key delta", async () => {
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const refresh = collectRefresh();
    const watcher = await createProjectWatcher(
      { config, projectRoot: root, debounceMs: 50 },
      { createWatcher: defaultCreateStudioWatcher },
    );
    watcher.onRefresh(refresh.listener);

    // The target file does not exist yet; only its parent directory ("locales/") does. Its startup
    // snapshot is therefore empty, established before this watcher started.
    await wait(200);
    await writeFile(join(root, "locales", "de.json"), JSON.stringify({ greeting: "hallo" }));
    await wait(600);

    // Real chokidar can occasionally split one underlying write into two raw notifications
    // (an "add" and a separately timed "change") more than the 50ms debounce window apart, under
    // system load; this is a pre-existing OS/chokidar notification-timing class, unrelated to this
    // ticket's delta logic. The first event is always the meaningful one, deterministically; any
    // further event must be a harmless zero-net-delta echo of the same settled state, never a
    // second real content change.
    expect(refresh.events.length).toBeGreaterThanOrEqual(1);
    expect(refresh.events[0]).toEqual({
      reason: "targets",
      at: expect.any(String),
      locale: "de",
      delta: { added: 1, changed: 0, removed: 0 },
    });
    for (const event of refresh.events.slice(1)) {
      expect(event).toEqual({
        reason: "targets",
        at: expect.any(String),
        locale: "de",
        delta: { added: 0, changed: 0, removed: 0 },
      });
    }
    await watcher.close();
  }, 5000);

  it("a real atomic temp-write-then-rename over the lock file raises exactly one lock refresh", async () => {
    const config: VerbatraConfig = baseStudioConfig({ targetLocales: ["de"] });
    const refresh = collectRefresh();
    const watcher = await createProjectWatcher(
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
    const watcher = await createProjectWatcher(
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
