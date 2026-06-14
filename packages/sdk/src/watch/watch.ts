import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import type { RunSummary } from "../flow/summary.js";
import type { TranslateInput } from "../flow/translate-project.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { localeFilePath } from "../paths.js";
import type { CreateProvider } from "../selection/select-provider.js";
import { defaultCreateWatcher, defaultRunTranslate } from "./wiring.js";

const DEFAULT_DEBOUNCE_MS = 300;

/** A minimal source-change event source. Production wraps chokidar; tests inject a stub. */
export interface Watcher {
  onChange(listener: () => void): void;
  close(): Promise<void>;
}

export type CreateWatcher = (paths: readonly string[]) => Watcher;

/** The run a watch trigger performs: the slice-1 one-shot translate, unchanged. */
export type RunTranslate = (input: TranslateInput) => Promise<RunSummary>;

/** The outcome of one run, surfaced to the caller; never carries a secret. */
export type WatchRunResult =
  | { readonly status: "succeeded"; readonly summary: RunSummary }
  | {
      readonly status: "failed";
      readonly error: { readonly code: string; readonly message: string };
    };

export interface WatchInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly debounceMs?: number;
  /** Called once per run with its result. The SDK does no logging; this is the only output. */
  readonly onRun: (result: WatchRunResult) => void;
}

/** Composition seam: inject the watcher and the run for deterministic, offline tests. */
export interface WatchDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly createProvider?: CreateProvider;
  readonly fs?: SdkFs;
  readonly createWatcher?: CreateWatcher;
  readonly runTranslate?: RunTranslate;
}

export interface WatchController {
  /** Stop accepting triggers, close the watcher, and await the in-flight run to completion. */
  stop(): Promise<void>;
}

function describeError(error: unknown): { code: string; message: string } {
  // A {code, message} projection of the run's failure (the slice-1 errors are secret-free).
  // "WATCH_RUN_FAILED" is a fallback label for the rare non-coded throw, not an SdkErrorCode.
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { code: typeof code === "string" ? code : "WATCH_RUN_FAILED", message: error.message };
  }
  return { code: "WATCH_RUN_FAILED", message: String(error) };
}

/**
 * Start watching the source file and re-run the one-shot translate on each debounced change.
 * Watch adds no translation/diff/lock logic: it watches, debounces, serializes, and invokes the
 * existing translate() unchanged. The state machine is IDLE <-> RUNNING with a single boolean
 * pending-rerun flag (mid-run changes collapse into one immediate follow-up; never two runs at
 * once). A missing source at startup is a hard error; a run that fails after start is reported and
 * watching continues. Returns a controller whose stop() closes the watcher and awaits the in-flight
 * run (the caller wires any signal, e.g. SIGINT, to it).
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
  const runInput: TranslateInput = { config: input.config, cwd };

  let state: "idle" | "running" = "idle";
  let pending = false;
  let stopped = false;
  let inFlight: Promise<void> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  async function runOnce(): Promise<void> {
    try {
      input.onRun({ status: "succeeded", summary: await runTranslate(runInput) });
    } catch (error) {
      // Caught so the in-flight promise NEVER rejects: a transient failure is reported and the
      // machine stays alive (a rejecting promise would break onRunComplete and stop the watcher).
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
      startRun(); // immediate follow-up: the source is known-stale, so no fresh debounce window
      return;
    }
    state = "idle";
    inFlight = undefined;
  }

  function onSettledChange(): void {
    // Reached only via the debounce timer, and stop() clears that timer before it can fire, so the
    // machine is never stopped here; no stopped-guard is needed (and adding one would be dead code).
    debounceTimer = undefined; // the single timer has fired and is cleared
    if (state === "idle") {
      startRun();
    } else {
      pending = true; // collapse: any number of mid-run changes set the one flag
    }
  }

  function onRawEvent(): void {
    if (stopped) {
      return;
    }
    // One timer, always restarted: a burst of raw events keeps resetting it, settling to one change.
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(onSettledChange, debounceMs);
  }

  const watcher = (deps.createWatcher ?? defaultCreateWatcher)([sourcePath]);
  watcher.onChange(onRawEvent);

  startRun(); // initial run on startup, so state is current at once

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
