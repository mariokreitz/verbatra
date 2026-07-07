/**
 * The studio-owned live-refresh watcher (G14/G15): watches the source locale file, every configured
 * target locale file, and the lock file, and raises a debounced, coalesced, payload-free
 * {@link RefreshEvent} per changed category. This never reuses the sdk's own watch mode: that seam
 * means "translate on source change" and watches only the source file; this module watches three
 * categories, never translates, and never carries file content or a diff (G12).
 *
 * Caveat (chokidar 5 parent-directory fallback): a target locale file that does not exist yet
 * when Studio starts is still watched, as long as its PARENT DIRECTORY already exists at startup;
 * chokidar detects the file once it is created and this module raises exactly one "targets"
 * refresh. A locale file whose parent directory is created after Studio starts is not picked up;
 * Studio must be restarted to pick up a newly created locale directory.
 */

import { resolve } from "node:path";
import { LOCK_FILE_NAME, type VerbatraConfig } from "@verbatra/sdk";
import { watch as chokidarWatch } from "chokidar";
import type { RefreshEvent, RefreshReason } from "../shared/sse-events.js";
import { localeFilePath } from "./locale-paths.js";
import type { CreateStudioWatcher, StudioWatcher } from "./types.js";

const DEFAULT_DEBOUNCE_MS = 300;

/** One category of watched paths and the reason its refresh events carry. */
interface WatchedCategory {
  readonly reason: RefreshReason;
  readonly paths: readonly string[];
}

/** The source file, the target locale files (when any are configured), and the lock file. */
function watchedCategories(
  config: VerbatraConfig,
  projectRoot: string,
): readonly WatchedCategory[] {
  const source = localeFilePath(projectRoot, config.files.pattern, config.sourceLocale);
  const targets = config.targetLocales.map((locale) =>
    localeFilePath(projectRoot, config.files.pattern, locale),
  );
  const lock = resolve(projectRoot, LOCK_FILE_NAME);

  const categories: WatchedCategory[] = [{ reason: "source", paths: [source] }];
  if (targets.length > 0) {
    categories.push({ reason: "targets", paths: targets });
  }
  categories.push({ reason: "lock", paths: [lock] });
  return categories;
}

/** A debounced trigger for one category: coalesces a burst of raw events into one emitted refresh. */
function createDebouncedTrigger(
  reason: RefreshReason,
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
        emit({ reason, at: new Date().toISOString() });
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

/** Composition seam: inject the watcher factory (production chokidar, or a fake for tests). */
export interface ProjectWatcherDeps {
  readonly createWatcher: CreateStudioWatcher;
}

/** A running live-refresh watcher over one project's source, target, and lock files. */
export interface ProjectWatcher {
  /** Registers a listener invoked once per debounced, coalesced refresh event. */
  onRefresh(listener: (event: RefreshEvent) => void): void;
  /** Stops every underlying watcher and clears any pending debounce timer. */
  close(): Promise<void>;
}

/**
 * Starts watching the given project's source, target, and lock files. Each category (source,
 * targets, lock) gets its own underlying {@link StudioWatcher} instance and its own debounce timer, so
 * a simultaneous change in two categories raises two distinct, correctly tagged refresh events
 * rather than one ambiguous one. No translation ever runs from this module, and no config watcher
 * exists here: config is process-lifetime only (G11).
 */
export function createProjectWatcher(
  input: ProjectWatcherInput,
  deps: ProjectWatcherDeps,
): ProjectWatcher {
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const listeners = new Set<(event: RefreshEvent) => void>();

  function emit(event: RefreshEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  const entries = watchedCategories(input.config, input.projectRoot).map((category) => {
    const debounced = createDebouncedTrigger(category.reason, debounceMs, emit);
    const watcher = deps.createWatcher(category.paths);
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
 * Production {@link CreateStudioWatcher}: wraps chokidar directly (a studio dependency in its own right,
 * G14/G15), watching exactly the given paths. `ignoreInitial` is set since this module has no
 * initial-run concept, unlike the sdk's own watch mode; both "change" and "add" map to the same
 * listener so a target file created after startup (chokidar's parent-directory fallback) is
 * treated the same as an edit to an existing one.
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
