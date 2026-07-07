import type { CheckDeps, LoadedConfig, SdkFs } from "@verbatra/sdk";

/** The result of one `execFileImpl` call: captured stdout and stderr, never a raw child_process error. */
export interface ExecFileResult {
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * A bounded, argument-array process runner: `execFile(file, args, options)`, never a shell string.
 * Mirrors `util.promisify(child_process.execFile)`. Consumed by the git-log history view, which
 * runs `git` with an explicit `cwd` and never a `--follow` or other unbounded argument.
 */
export type ExecFileImpl = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string },
) => Promise<ExecFileResult>;

/**
 * A minimal change-event source for the live-refresh stream. Mirrors the shape of the sdk's own
 * `Watcher` (see `@verbatra/sdk`'s `watch.ts`) but is ui-owned: production wraps chokidar directly
 * (a ui dependency in its own right), tests inject a stub.
 */
export interface UiWatcher {
  /** Register a listener invoked once per coalesced, debounced change event. */
  onChange(listener: () => void): void;
  /** Stop watching and release the underlying resources. */
  close(): Promise<void>;
}

/** Builds a {@link UiWatcher} over the given paths (the source file, target files, and the lock-file). */
export type CreateUiWatcher = (paths: readonly string[]) => UiWatcher;

/**
 * Every dependency an RPC handler or the server itself may need, across the whole dashboard, fully
 * pre-declared up front so later handlers never widen this type. Most fields are unused until a
 * later view lands; each doc comment names what consumes it.
 */
export interface UiServerDeps {
  /**
   * Resolves the project configuration exactly once, at server startup, before the server starts
   * listening. Every RPC handler receives that same resolved value for the life of the process; it
   * is never re-invoked per request, and the server holds no other project-derived cache. Consumed
   * by every RPC handler, starting with the project configuration snapshot.
   */
  readonly loader: () => Promise<LoadedConfig>;
  /** Bounded file-system seam for the status and diff drift views. */
  readonly fs?: SdkFs;
  /** Format-adapter registry override for the status and diff drift views; defaults to the sdk's own registry. */
  readonly adapterRegistry?: NonNullable<CheckDeps["adapterRegistry"]>;
  /** Bounded, argument-array process runner for the git-log history view. */
  readonly execFileImpl?: ExecFileImpl;
  /** Factory for the file watcher backing the live-refresh event stream. */
  readonly createWatcher?: CreateUiWatcher;
  /** Interval between live-refresh heartbeat frames; injected so tests never depend on a real timer. */
  readonly heartbeatIntervalMs?: number;
  /** Bootstrap token the server accepts. Omit to have the server generate one from secure randomness. */
  readonly token?: string;
  /** Sink for the startup banner and the per-request log line. Defaults to writing to the console. */
  readonly output?: (line: string) => void;
  /** Overrides where static assets are served from; defaults to the built SPA next to this module. */
  readonly assetsRoot?: URL;
}

/** Options accepted by {@link startUiServer}: every {@link UiServerDeps} field, plus the bind port and cwd. */
export interface UiServerOptions extends UiServerDeps {
  /** TCP port to bind. Omit for the default Studio port, or pass 0 to let the OS assign an ephemeral port (tests only). */
  readonly port?: number;
  /**
   * The project root every RPC handler resolves relative paths against: the source locale file,
   * each target locale file, the lock file, and the git repository root for the history view.
   * Omit to use `process.cwd()`, which is also the behavior of any existing caller that does not
   * pass this.
   */
  readonly cwd?: string;
}

/** A running Verbatra Studio server instance. */
export interface UiServer {
  /** The loopback URL the server is reachable at, including the actual bound port. */
  readonly url: string;
  /** The actual bound TCP port (relevant when `port` was omitted or 0). */
  readonly port: number;
  /** Stops accepting new connections and closes the server. */
  close(): Promise<void>;
}
