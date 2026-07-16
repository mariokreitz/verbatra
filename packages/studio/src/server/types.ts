import type { CheckDeps, CreateProvider, LoadedConfig, SdkFs } from "@verbatra/sdk";

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
 * `Watcher` (see `@verbatra/sdk`'s `watch.ts`) but is studio-owned: production wraps chokidar directly
 * (a studio dependency in its own right), tests inject a stub.
 */
export interface StudioWatcher {
  /** Register a listener invoked once per coalesced, debounced change event. */
  onChange(listener: () => void): void;
  /** Stop watching and release the underlying resources. */
  close(): Promise<void>;
}

/** Builds a {@link StudioWatcher} over the given paths (the source file, target files, and the lock-file). */
export type CreateStudioWatcher = (paths: readonly string[]) => StudioWatcher;

/**
 * Every dependency an RPC handler or the server itself may need, across the whole dashboard, fully
 * pre-declared up front so later handlers never widen this type. Most fields are unused until a
 * later view lands; each doc comment names what consumes it.
 */
export interface StudioServerDeps {
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
  readonly createWatcher?: CreateStudioWatcher;
  /** Interval between live-refresh heartbeat frames; injected so tests never depend on a real timer. */
  readonly heartbeatIntervalMs?: number;
  /** Bootstrap token the server accepts. Omit to have the server generate one from secure randomness. */
  readonly token?: string;
  /** Sink for the startup banner and the per-request log line. Defaults to writing to the console. */
  readonly output?: (line: string) => void;
  /** Overrides where static assets are served from; defaults to the built SPA next to this module. */
  readonly assetsRoot?: URL;
  /**
   * Authorizes a provider invocation (network egress, an API key read from its environment
   * variable, a billable call). Resolved once at process start (CLI flag or environment variable
   * fallback) and read exactly once here, before `listen()`; never re-derived and never an RPC
   * parameter. Off (`false`) by default. Composed independently with {@link writeToDisk}: neither
   * implies the other.
   */
  readonly spend?: boolean;
  /**
   * Authorizes mutating a source-controlled locale file and its lock entry. Resolved once at
   * process start (CLI flag or environment variable fallback) and read exactly once here, before
   * `listen()`; never re-derived and never an RPC parameter. Off (`false`) by default.
   */
  readonly writeToDisk?: boolean;
  /** Provider builder for the write-capable RPC handlers; defaults to constructing the configured provider (which reads its key from env). Test-only injection seam, mirroring the sdk's own `TranslateDeps.createProvider`. */
  readonly createProvider?: CreateProvider;
  /** Rolling window, in milliseconds, `translation.retranslateEntry`'s dispatch-layer rate limit is measured over. Defaults to a production-sized window; tests override it to trip the limit deterministically. */
  readonly retranslateRateLimitWindowMs?: number;
  /** Maximum `translation.retranslateEntry` calls allowed within the rolling window before `RATE_LIMITED`. */
  readonly retranslateRateLimitMax?: number;
  /** Rolling window, in milliseconds, `translation.editEntry`'s dispatch-layer rate limit is measured over. Defaults to a production-sized window; tests override it to trip the limit deterministically. */
  readonly editEntryRateLimitWindowMs?: number;
  /** Maximum `translation.editEntry` calls allowed within the rolling window before `RATE_LIMITED`. */
  readonly editEntryRateLimitMax?: number;
}

/** Options accepted by {@link startStudioServer}: every {@link StudioServerDeps} field, plus the bind port and cwd. */
export interface StudioServerOptions extends StudioServerDeps {
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
export interface StudioServer {
  /** The loopback URL the server is reachable at, including the actual bound port. */
  readonly url: string;
  /** The actual bound TCP port (relevant when `port` was omitted or 0). */
  readonly port: number;
  /** Stops accepting new connections and closes the server. */
  close(): Promise<void>;
}
