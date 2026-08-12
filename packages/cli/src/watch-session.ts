import type { VerbatraConfig, WatchInput, WatchRunResult } from "@verbatra/sdk";
import { renderErrorEnvelope, renderRunResultEnvelope } from "./json-envelope.js";
import {
  renderError,
  renderLockWait,
  renderProgress,
  renderRunResultHuman,
  toRenderableError,
} from "./render.js";
import type { CliDeps, Streams, WatchSession } from "./types.js";

/** Inputs for a watch session: the validated config, where to run, the debounce window, and output mode. */
export interface WatchOptions {
  /** The validated configuration. */
  readonly config: VerbatraConfig;
  /** Resolved working directory to translate against; the command resolves it once per run. */
  readonly cwd: string;
  /** Debounce window in milliseconds; defaults to the SDK's 300ms. */
  readonly debounceMs?: number;
  /** Write-lock acquire timeout in milliseconds; defaults to the SDK's 10-minute default. */
  readonly lockAcquireTimeoutMs?: number;
  /** How many target locales each run may translate at once; defaults to the SDK's 1 (serial). */
  readonly concurrency?: number;
  /** When false, bypass the translation-memory cache on every run (read and write); on by default. */
  readonly cache?: boolean;
  /** When true, emit NDJSON records; otherwise human-readable output. */
  readonly json: boolean;
}

/**
 * Starts a watch session over the SDK's watch(). Per-run results are rendered to stdout; the startup
 * line, "stopping" notice, and any startup or stop error go to stderr. A stop requested before the
 * watcher is ready is honored as soon as it is; a stop requested after a startup failure is a no-op.
 *
 * @param options - The config, cwd/debounce, and output mode.
 * @param deps - The SDK entry points (its `watch` is used here).
 * @param streams - The stdout/stderr sink.
 * @returns A {@link WatchSession}: `done` resolves the exit code (0 clean stop, 130 forced second stop,
 *   2 startup or stop failure); `requestStop` is wired to the interrupt signals by the bin shim.
 */
export function runWatch(options: WatchOptions, deps: CliDeps, streams: Streams): WatchSession {
  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((resolve) => {
    resolveDone = resolve;
  });

  let controller: { stop(): Promise<void> } | undefined;
  let stopping = false;
  let startupFailed = false;

  /**
   * Reports a session-level failure (the watcher never started, or it failed to stop) and resolves
   * the session with exit `2`.
   *
   * The human-readable line goes to stderr in both modes, unchanged. Under `--json` the same
   * secret-free projection is also written to stdout as one error envelope, matching what every
   * other command does for a whole-run failure and what a failed run already emits on this stream.
   * Without it a `--json` consumer parsing stdout saw nothing at all for a watch that failed to
   * start, while the identical error under `translate --json` produced an envelope.
   */
  const failSession = (error: unknown): void => {
    const renderable = toRenderableError(error);
    streams.err(`${renderError(renderable)}\n`);
    if (options.json) {
      streams.out(`${renderErrorEnvelope("watch", renderable)}\n`);
    }
    resolveDone(2);
  };

  /** A clean stop resolves 0; a rejected stop reports the error and resolves 2. */
  const stopController = (c: { stop(): Promise<void> }): void => {
    void c
      .stop()
      .then(() => resolveDone(0))
      .catch(failSession);
  };

  const onRun = (result: WatchRunResult): void => {
    streams.out(
      options.json ? `${renderRunResultEnvelope(result)}\n` : `${renderRunResultHuman(result)}\n`,
    );
  };

  streams.err(
    `verbatra: watching ${options.config.sourceLocale} (${options.config.files.pattern}); running initial translation\n`,
  );

  const watchInput: WatchInput = {
    config: options.config,
    onRun,
    cwd: options.cwd,
    onLockWait: (event) => {
      streams.err(`${renderLockWait(event, options.json)}\n`);
    },
    onProgress: (event) => {
      streams.err(`${renderProgress(event, options.json)}\n`);
    },
    ...(options.debounceMs !== undefined ? { debounceMs: options.debounceMs } : {}),
    ...(options.lockAcquireTimeoutMs !== undefined
      ? { lockAcquireTimeoutMs: options.lockAcquireTimeoutMs }
      : {}),
    ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
    ...(options.cache === false ? { cache: false } : {}),
  };

  deps
    .watch(watchInput)
    .then((c) => {
      controller = c;
      if (stopping) {
        stopController(c);
      }
    })
    .catch((error: unknown) => {
      startupFailed = true;
      failSession(error);
    });

  const requestStop = (): void => {
    if (startupFailed) {
      return;
    }
    if (!stopping) {
      stopping = true;
      streams.err("verbatra: stopping, finishing current run...\n");
      if (controller !== undefined) {
        stopController(controller);
      }
      return;
    }
    resolveDone(130);
  };

  return { done, requestStop };
}
