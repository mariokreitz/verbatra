import type { VerbatraConfig, WatchInput, WatchRunResult } from "@verbatra/sdk";
import {
  renderError,
  renderRunResultHuman,
  renderRunResultNdjson,
  toRenderableError,
} from "./render.js";
import type { CliDeps, Streams, WatchSession } from "./types.js";

/** Inputs for a watch session: the validated config, where to run, the debounce window, and output mode. */
export interface WatchOptions {
  /** The validated configuration. */
  readonly config: VerbatraConfig;
  /** Directory to resolve config and locale files against; defaults to the SDK's cwd. */
  readonly cwd?: string;
  /** Debounce window in milliseconds; defaults to the SDK's 300ms. */
  readonly debounceMs?: number;
  /** When true, emit NDJSON records; otherwise human-readable output. */
  readonly json: boolean;
}

/**
 * Start a watch session over the SDK's watch(). Per-run results (success AND failure) are rendered
 * to stdout (under --json they are the NDJSON stream, so a failure is a record, not noise); the
 * startup line, "stopping" notice, and any startup error go to stderr. The session resolves an exit
 * code: 0 on a clean stop, 130 on a forced second stop, 2 if watch() fails to start.
 *
 * @param options - The config, cwd/debounce, and output mode.
 * @param deps - The SDK entry points (its `watch` is used here).
 * @param streams - The stdout/stderr sink.
 * @returns A {@link WatchSession}: `done` resolves the exit code (0 clean stop, 130 forced second stop, 2
 *   startup failure); `requestStop` is wired to the interrupt signals by the bin shim.
 */
export function runWatch(options: WatchOptions, deps: CliDeps, streams: Streams): WatchSession {
  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((resolve) => {
    resolveDone = resolve;
  });

  let controller: { stop(): Promise<void> } | undefined;
  let stopping = false;
  let startupFailed = false;

  const onRun = (result: WatchRunResult): void => {
    streams.out(
      options.json ? `${renderRunResultNdjson(result)}\n` : `${renderRunResultHuman(result)}\n`,
    );
  };

  streams.err(
    `verbatra: watching ${options.config.sourceLocale} (${options.config.files.pattern}); running initial translation\n`,
  );

  const watchInput: WatchInput = {
    config: options.config,
    onRun,
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.debounceMs !== undefined ? { debounceMs: options.debounceMs } : {}),
  };

  deps
    .watch(watchInput)
    .then((c) => {
      controller = c;
      // A stop requested during startup is honored as soon as the controller exists.
      if (stopping) {
        void c.stop().then(() => resolveDone(0));
      }
    })
    .catch((error: unknown) => {
      startupFailed = true;
      streams.err(`${renderError(toRenderableError(error))}\n`);
      resolveDone(2);
    });

  const requestStop = (): void => {
    if (startupFailed) {
      return;
    }
    if (!stopping) {
      stopping = true;
      streams.err("verbatra: stopping, finishing current run...\n");
      if (controller !== undefined) {
        void controller.stop().then(() => resolveDone(0));
      }
      // else: the watch() .then above will stop once the controller is ready.
      return;
    }
    // Second stop while the first is still in flight: force immediate exit (bounded-safe by the
    // SDK's atomic writes). resolveDone is idempotent, so this wins only if 0 has not resolved yet.
    resolveDone(130);
  };

  return { done, requestStop };
}
