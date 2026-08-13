import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { describeError, SdkError } from "../errors.js";
import type { RunSummary } from "../flow/summary.js";
import { resolveRunConcurrency, type TranslateInput } from "../flow/translate-project.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { createLocalePathResolver } from "../locale-path/resolver.js";
import type { LockWaitListener } from "../lock/locale-write-lock.js";
import type { ProgressListener } from "../progress/types.js";
import type { CreateProvider } from "../selection/select-provider.js";
import { defaultCreateWatcher, defaultRunTranslate } from "./wiring.js";

const DEFAULT_DEBOUNCE_MS = 300;

export interface Watcher {
  onChange(listener: () => void): void;
  close(): Promise<void>;
}

export type CreateWatcher = (paths: readonly string[]) => Watcher;

export type RunTranslate = (input: TranslateInput) => Promise<RunSummary>;

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
  readonly onRun: (result: WatchRunResult) => void;
  readonly onLockWait?: LockWaitListener;
  readonly onProgress?: ProgressListener;
  readonly lockAcquireTimeoutMs?: number;
  readonly concurrency?: number;
  readonly cache?: boolean;
}

export interface WatchDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly createProvider?: CreateProvider;
  readonly fs?: SdkFs;
  readonly createWatcher?: CreateWatcher;
  readonly runTranslate?: RunTranslate;
}

export interface WatchController {
  stop(): Promise<void>;
}

export async function watch(input: WatchInput, deps: WatchDeps = {}): Promise<WatchController> {
  const cwd = input.cwd ?? process.cwd();
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const fs = deps.fs ?? defaultFs;

  resolveRunConcurrency(input.concurrency, false, input.config);

  const resolver = createLocalePathResolver(cwd, input.config);
  const sourcePath = resolver.pathFor(input.config.sourceLocale);
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
    ...(input.concurrency !== undefined ? { concurrency: input.concurrency } : {}),
    ...(input.cache !== undefined ? { cache: input.cache } : {}),
  };

  let state: "idle" | "running" = "idle";
  let pending = false;
  let stopped = false;
  let inFlight: Promise<void> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  async function runOnce(): Promise<void> {
    try {
      input.onRun({ status: "succeeded", summary: await runTranslate(runInput) });
    } catch (error) {
      input.onRun({ status: "failed", error: describeError(error, "WATCH_RUN_FAILED") });
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
