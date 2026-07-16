import { resolve } from "node:path";
import {
  diffLocaleSnapshots,
  LOCK_FILE_NAME,
  type LocaleFileSnapshot,
  type LocaleSnapshotDelta,
  type ReadLocaleFileSnapshotDeps,
  readLocaleFileSnapshot,
  type SdkFs,
  type VerbatraConfig,
} from "@verbatra/sdk";
import { watch as chokidarWatch } from "chokidar";
import type { RefreshEvent, RefreshReason } from "../shared/sse-events.js";
import { localeFilePath } from "./locale-paths.js";
import type { CreateStudioWatcher, StudioWatcher } from "./types.js";

const DEFAULT_DEBOUNCE_MS = 300;

/** One watched entry: its refresh reason, its watched paths, and (for a locale file) which locale it is. */
interface WatchedEntry {
  readonly reason: RefreshReason;
  readonly paths: readonly string[];
  /** The locale this entry reports on; present for "source" and "targets", absent for "lock". */
  readonly locale?: string;
}

/** The source file, every configured target locale file as its own entry, and the lock file. */
function watchedEntries(config: VerbatraConfig, projectRoot: string): readonly WatchedEntry[] {
  const source = localeFilePath(projectRoot, config.files.pattern, config.sourceLocale);
  const targets: WatchedEntry[] = config.targetLocales.map((locale) => ({
    reason: "targets",
    paths: [localeFilePath(projectRoot, config.files.pattern, locale)],
    locale,
  }));
  const lock = resolve(projectRoot, LOCK_FILE_NAME);

  return [
    { reason: "source", paths: [source], locale: config.sourceLocale },
    ...targets,
    { reason: "lock", paths: [lock] },
  ];
}

/** Reads one locale's key-hash snapshot; the seam {@link ProjectWatcherDeps.readLocaleSnapshot} overrides. */
type ReadLocaleSnapshot = (locale: string) => Promise<LocaleFileSnapshot>;

/**
 * Tracks one locale file's last observed snapshot and serializes settling a new one against it.
 *
 * A settle awaits an async snapshot read before it can emit, so two rapid, distinct changes to
 * the same locale file can have their debounce windows straddle that read (one still in flight
 * when the next one's timer fires). Without serialization, whichever read resolved last would
 * overwrite `previous`, regardless of which change actually settled last, corrupting the
 * baseline for the next delta. `tail` prevents this: a settle's read never starts until the
 * previous settle's read, diff, and store have fully completed, so two settles for one locale
 * always run in trigger order. The tail chain itself never rejects, or every later settle for
 * the locale would be skipped.
 */
function createSnapshotTracker(
  initial: LocaleFileSnapshot,
  readSnapshot: () => Promise<LocaleFileSnapshot>,
): { readonly settle: () => Promise<LocaleSnapshotDelta> } {
  let previous = initial;
  let tail: Promise<void> = Promise.resolve();

  function settle(): Promise<LocaleSnapshotDelta> {
    const attempt = tail.then(async () => {
      const current = await readSnapshot();
      const delta = diffLocaleSnapshots(previous, current);
      previous = current;
      return delta;
    });
    tail = attempt.then(
      () => undefined,
      () => undefined,
    );
    return attempt;
  }

  return { settle };
}

type SnapshotTracker = ReturnType<typeof createSnapshotTracker>;

/**
 * Builds the emitted event for one settled trigger. A lock entry (no tracker) emits the bare
 * `{ reason, at }` shape. A source or target entry awaits its tracker's delta and merges in
 * `locale` and `delta`; a read or parse failure (for example a transient external edit caught
 * mid-write) falls back to the bare shape instead of losing the refresh entirely, and leaves the
 * tracker's stored snapshot untouched so the next successful settle still diffs against a valid
 * baseline.
 */
async function buildRefreshEvent(
  entry: WatchedEntry,
  tracker: SnapshotTracker | undefined,
): Promise<RefreshEvent> {
  const at = new Date().toISOString();
  if (tracker === undefined || entry.locale === undefined) {
    return { reason: entry.reason, at };
  }
  try {
    const delta = await tracker.settle();
    return { reason: entry.reason, at, locale: entry.locale, delta };
  } catch {
    return { reason: entry.reason, at };
  }
}

/** A debounced trigger for one entry: coalesces a burst of raw events into one emitted refresh. */
function createDebouncedTrigger(
  entry: WatchedEntry,
  tracker: SnapshotTracker | undefined,
  debounceMs: number,
  emit: (event: RefreshEvent) => void,
): { readonly trigger: () => void; readonly clear: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    trigger(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        void buildRefreshEvent(entry, tracker).then(emit);
      }, debounceMs);
    },
    clear(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

/** Input for {@link createProjectWatcher}: the resolved config, project root, and optional debounce override. */
export interface ProjectWatcherInput {
  readonly config: VerbatraConfig;
  readonly projectRoot: string;
  /** Quiet period after the last raw change before a refresh fires; defaults to 300ms. */
  readonly debounceMs?: number;
}

/** Composition seams for {@link createProjectWatcher}: the watcher factory plus the snapshot-read wiring. */
export interface ProjectWatcherDeps {
  /** Factory for the underlying per-entry watchers: production chokidar, or a fake for tests. */
  readonly createWatcher: CreateStudioWatcher;
  /** Format-adapter registry override for the per-locale snapshot reads; defaults to the sdk's own registry. */
  readonly adapterRegistry?: NonNullable<ReadLocaleFileSnapshotDeps["adapterRegistry"]>;
  /** Bounded file-system seam for the per-locale snapshot reads; defaults to the sdk's real file system. */
  readonly fs?: SdkFs;
  /**
   * Reads one locale's key-hash snapshot; defaults to the sdk's `readLocaleFileSnapshot`, wired
   * with the config, the project root, and `adapterRegistry`/`fs` above. Overridable so a test
   * can control exactly when a snapshot read resolves.
   */
  readonly readLocaleSnapshot?: ReadLocaleSnapshot;
}

/** A running live-refresh watcher over one project's source, target, and lock files. */
export interface ProjectWatcher {
  /** Registers a listener invoked once per debounced, coalesced refresh event. */
  onRefresh(listener: (event: RefreshEvent) => void): void;
  /**
   * Stops every underlying watcher and clears any pending debounce timer. Does not await an
   * in-flight settle: a delta still resolving after this returns will emit into whatever
   * listener is still registered, so a caller that needs a post-close emit to be a no-op must
   * detach or close its own downstream sink first.
   */
  close(): Promise<void>;
}

function buildReadLocaleSnapshot(
  input: ProjectWatcherInput,
  deps: ProjectWatcherDeps,
): ReadLocaleSnapshot {
  if (deps.readLocaleSnapshot !== undefined) {
    return deps.readLocaleSnapshot;
  }
  const snapshotDeps: ReadLocaleFileSnapshotDeps = {
    ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
    ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
  };
  return (locale) =>
    readLocaleFileSnapshot({ config: input.config, locale, cwd: input.projectRoot }, snapshotDeps);
}

/** Pairs one watched entry with its snapshot tracker (source and targets) or none (lock), priming the tracker's initial snapshot up front. */
async function primeEntry(
  entry: WatchedEntry,
  readSnapshot: ReadLocaleSnapshot,
): Promise<{ readonly entry: WatchedEntry; readonly tracker: SnapshotTracker | undefined }> {
  if (entry.locale === undefined) {
    return { entry, tracker: undefined };
  }
  const locale = entry.locale;
  const read = (): Promise<LocaleFileSnapshot> => readSnapshot(locale);
  const initial = await readInitialSnapshot(locale, read);
  return { entry, tracker: createSnapshotTracker(initial, read) };
}

/**
 * Reads a locale's startup snapshot, falling back to an empty one on failure (for example a
 * locale file already malformed on disk before Studio starts). The other views surface a
 * malformed file as a structured RPC error on their own next call; this fallback only keeps one
 * bad file from preventing the server from starting, at the cost of degrading that locale's next
 * delta report until the file becomes readable again.
 */
async function readInitialSnapshot(
  locale: string,
  read: () => Promise<LocaleFileSnapshot>,
): Promise<LocaleFileSnapshot> {
  try {
    return await read();
  } catch {
    return { locale, hashes: new Map() };
  }
}

/**
 * Starts the studio-owned live-refresh watcher over the project's source locale file, each
 * configured target locale file, and the lock file. Every locale file gets its own underlying
 * {@link StudioWatcher}, debounce timer, and snapshot tracker, so simultaneous changes to two
 * different files raise two distinct, correctly tagged refresh events. Before any watcher is
 * created, an initial snapshot of every locale file is read (a missing or unreadable file reads
 * as empty, never throwing), establishing the baseline the first change after startup is diffed
 * against; no raw change can race the initial snapshot. Emitted events carry only a reason, a
 * timestamp, and (for locale files) per-locale added/changed/removed key counts: never file
 * content, a key name, or a translated value. No translation ever runs from this module, and the
 * config is not watched: it is resolved once for the process lifetime.
 */
export async function createProjectWatcher(
  input: ProjectWatcherInput,
  deps: ProjectWatcherDeps,
): Promise<ProjectWatcher> {
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const listeners = new Set<(event: RefreshEvent) => void>();

  function emit(event: RefreshEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  const readSnapshot = buildReadLocaleSnapshot(input, deps);
  const primed = await Promise.all(
    watchedEntries(input.config, input.projectRoot).map((entry) => primeEntry(entry, readSnapshot)),
  );

  const entries = primed.map(({ entry, tracker }) => {
    const debounced = createDebouncedTrigger(entry, tracker, debounceMs, emit);
    const watcher = deps.createWatcher(entry.paths);
    watcher.onChange(debounced.trigger);
    return { debounced, watcher };
  });

  return {
    onRefresh(listener: (event: RefreshEvent) => void): void {
      listeners.add(listener);
    },
    async close(): Promise<void> {
      for (const entry of entries) {
        entry.debounced.clear();
      }
      await Promise.all(entries.map((entry) => entry.watcher.close()));
    },
  };
}

/**
 * Production {@link CreateStudioWatcher}: wraps chokidar directly, watching exactly the given
 * paths with `ignoreInitial` set. Both "change" and "add" map to the same listener, so a target
 * file created after startup is treated the same as an edit to an existing one. Chokidar's
 * parent-directory fallback means a locale file that does not exist yet at startup is still
 * picked up once created, as long as its parent directory already exists at startup; a file
 * whose parent directory is created later is not, and Studio must be restarted to see it.
 */
export const defaultCreateStudioWatcher: CreateStudioWatcher = (paths): StudioWatcher => {
  const fsWatcher = chokidarWatch([...paths], { persistent: true, ignoreInitial: true });
  return {
    onChange(listener: () => void): void {
      fsWatcher.on("change", () => listener());
      fsWatcher.on("add", () => listener());
    },
    close: () => fsWatcher.close(),
  };
};
