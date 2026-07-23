import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import type { RunSummary } from "../flow/summary.js";
import type { TranslateInput } from "../flow/translate-project.js";
import { defaultFs, type SdkFs } from "../fs.js";
import type { LockWaitListener } from "../lock/locale-write-lock.js";
import { localeFilePath } from "../paths.js";
import type { ProgressListener } from "../progress/types.js";
import type { CreateProvider } from "../selection/select-provider.js";
import { defaultCreateWatcher, defaultRunTranslate } from "./wiring.js";

const DEFAULT_DEBOUNCE_MS = 300;

/** A minimal source-change event source. Production wraps chokidar; tests inject a stub. */
export interface Watcher {
  /** Register a listener invoked once per coalesced source-change event. */
  onChange(listener: () => void): void;
  /** Stop watching and release the underlying resources. */
  close(): Promise<void>;
}

/** Builds a {@link Watcher} for the given paths; the seam production fills with chokidar. */
export type CreateWatcher = (paths: readonly string[]) => Watcher;

/** The run a watch trigger performs: the one-shot translate, unchanged. */
export type RunTranslate = (input: TranslateInput) => Promise<RunSummary>;

/** The outcome of one run, surfaced to the caller; never carries a secret. */
export type WatchRunResult =
  | { readonly status: "succeeded"; readonly summary: RunSummary }
  | {
      readonly status: "failed";
      /**
       * A secret-free projection of the run's failure. `code` is a preserved string (the underlying
       * error's `code`, or `"WATCH_RUN_FAILED"` as a fallback), not an {@link SdkErrorCode}.
       */
      readonly error: { readonly code: string; readonly message: string };
    };

/** Everything watch mode needs: the config, optional cwd/debounce, and the per-run output callback. */
export interface WatchInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to the current working directory. */
  readonly cwd?: string;
  /** Quiet period after the last change before a run fires; defaults to 300ms. */
  readonly debounceMs?: number;
  /** Called once per run with its result. The SDK does no logging; this is the only output. */
  readonly onRun: (result: WatchRunResult) => void;
  /**
   * Passed through to every run's {@link TranslateInput.onLockWait}: called while a locale's write lock
   * is blocked on another process, so a watch caller can surface the same "still waiting" progress a
   * one-shot run does.
   */
  readonly onLockWait?: LockWaitListener;
  /**
   * Passed through to every run's {@link TranslateInput.onProgress}: fires per locale and per provider
   * sub-batch as each run advances, so a watch caller can surface the same progress a one-shot run does.
   */
  readonly onProgress?: ProgressListener;
  /** Passed through to every run's {@link TranslateInput.lockAcquireTimeoutMs}; the lock's 10-minute default when unset. */
  readonly lockAcquireTimeoutMs?: number;
}

/** Composition seam: inject the watcher and the run for deterministic, offline tests. */
export interface WatchDeps {
  /** Adapter registry passed through to each run; defaults to the built-in registry. */
  readonly adapterRegistry?: AdapterRegistry;
  /** Provider builder passed through to each run; defaults to constructing the configured provider. */
  readonly createProvider?: CreateProvider;
  /** File system passed through to each run; defaults to the real file system. */
  readonly fs?: SdkFs;
  /** Source-change event source; defaults to the chokidar-backed watcher. */
  readonly createWatcher?: CreateWatcher;
  /** The run a trigger performs; defaults to the one-shot {@link translate}. */
  readonly runTranslate?: RunTranslate;
}

/** Handle returned by {@link watch} to stop it. */
export interface WatchController {
  /** Stop accepting triggers, close the watcher, and await the in-flight run to completion. */
  stop(): Promise<void>;
}

/** Project any thrown value onto the secret-free `{ code, message }` shape of a failed run. */
function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { code: typeof code === "string" ? code : "WATCH_RUN_FAILED", message: error.message };
  }
  return { code: "WATCH_RUN_FAILED", message: String(error) };
}

/**
 * Start watching the source file and re-run the one-shot {@link translate} on each debounced change.
 * Runs are serialized: changes during a run collapse into a single follow-up, so two runs never
 * overlap. A missing source at startup throws; every run outcome after start is surfaced through
 * `onRun` as a {@link WatchRunResult} and watching continues. Returns a controller whose `stop()`
 * closes the watcher and awaits the in-flight run.
 *
 * @param input - The config, optional cwd/debounce, and the `onRun` callback that receives each result.
 * @param deps - Optional composition seams (watcher, run, registry, provider builder, file system) for tests.
 * @returns A {@link WatchController}; call `stop()` to close the watcher and await the in-flight run.
 * @throws {@link SdkError} `SOURCE_UNREADABLE`: at startup only, when the source locale file is absent.
 * @example
 * ```ts
 * import { loadConfig, watch } from "@verbatra/sdk";
 *
 * // The provider reads its API key from the environment (e.g. ANTHROPIC_API_KEY); no key is passed here.
 * const config = await loadConfig();
 * const controller = await watch({
 *   config,
 *   onRun: (result) => {
 *     if (result.status === "succeeded") {
 *       console.log(`ran: ${result.summary.succeeded.length} ok, ${result.summary.failed.length} failed`);
 *     } else {
 *       // Surfaced, not thrown: code is a preserved string (WATCH_RUN_FAILED is only the fallback).
 *       console.error(`run failed: ${result.error.code} ${result.error.message}`);
 *     }
 *   },
 * });
 *
 * // Stop cleanly on Ctrl-C: closes the watcher and awaits the in-flight run.
 * process.on("SIGINT", () => {
 *   void controller.stop();
 * });
 * ```
 */
export async function watch(input: WatchInput, deps: WatchDeps = {}): Promise<WatchController> {
  const cwd = input.cwd ?? process.cwd();
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const fs = deps.fs ?? defaultFs;

  const sourcePath = localeFilePath(cwd, input.config.files.pattern, input.config.sourceLocale);
  if (!(await fs.fileExists(sourcePath))) {
    throw new SdkError(
      "SOURCE_UNREADABLE",
      `The source locale file was not found at ${sourcePath}.`,
    );
  }

  const runTranslate = deps.runTranslate ?? defaultRunTranslate(deps);
  const runInput: TranslateInput = {
    config: input.config,
    cwd,
    ...(input.onLockWait !== undefined ? { onLockWait: input.onLockWait } : {}),
    ...(input.onProgress !== undefined ? { onProgress: input.onProgress } : {}),
    ...(input.lockAcquireTimeoutMs !== undefined
      ? { lockAcquireTimeoutMs: input.lockAcquireTimeoutMs }
      : {}),
  };

  let state: "idle" | "running" = "idle";
  let pending = false;
  let stopped = false;
  let inFlight: Promise<void> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  /** One run; a failure is surfaced through onRun, never thrown, so the in-flight promise never rejects. */
  async function runOnce(): Promise<void> {
    try {
      input.onRun({ status: "succeeded", summary: await runTranslate(runInput) });
    } catch (error) {
      input.onRun({ status: "failed", error: describeError(error) });
    }
  }

  function startRun(): void {
    state = "running";
    inFlight = runOnce().then(onRunComplete);
  }

  function onRunComplete(): void {
    if (stopped) {
      state = "idle";
      pending = false;
      inFlight = undefined;
      return;
    }
    if (pending) {
      pending = false;
      startRun();
      return;
    }
    state = "idle";
    inFlight = undefined;
  }

  /**
   * The debounce window elapsed: start a run, or mark a follow-up if one is in flight. The source
   * is then known-stale, so the follow-up starts immediately on completion with no fresh debounce
   * window. No stopped-guard is needed: stop() clears the timer before it can fire.
   */
  function onSettledChange(): void {
    debounceTimer = undefined;
    if (state === "idle") {
      startRun();
    } else {
      pending = true;
    }
  }

  function onRawEvent(): void {
    if (stopped) {
      return;
    }
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(onSettledChange, debounceMs);
  }

  const watcher = (deps.createWatcher ?? defaultCreateWatcher)([sourcePath]);
  watcher.onChange(onRawEvent);

  startRun();

  async function stop(): Promise<void> {
    stopped = true;
    pending = false;
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    await watcher.close();
    if (inFlight !== undefined) {
      await inFlight;
    }
  }

  return { stop };
}
