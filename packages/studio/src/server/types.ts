import type { CheckDeps, CreateProvider, LoadedConfig, SdkFs } from "@verbatra/sdk";

/** The result of one {@link ExecFileImpl} call: captured stdout and stderr. */
export interface ExecFileResult {
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * An argument-array process runner, never a shell string. Mirrors the shape of
 * `util.promisify(child_process.execFile)`. Consumed by the git-log history view, which runs
 * `git` with an explicit `cwd`.
 */
export type ExecFileImpl = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string },
) => Promise<ExecFileResult>;

/**
 * A minimal change-event source for the live-refresh stream. Studio-owned: production wraps
 * chokidar directly, tests inject a stub.
 */
export interface StudioWatcher {
  /** Registers a listener invoked on each raw change event from the underlying watcher. */
  onChange(listener: () => void): void;
  /** Stops watching and releases the underlying resources. */
  close(): Promise<void>;
}

/** Builds a {@link StudioWatcher} over the given absolute paths. */
export type CreateStudioWatcher = (paths: readonly string[]) => StudioWatcher;

/**
 * Every dependency the server or an RPC handler may need. All fields except `loader` are
 * optional injection seams with production defaults.
 */
export interface StudioServerDeps {
  /**
   * Resolves the project configuration exactly once, at server startup, before the server starts
   * listening. Every RPC handler receives that same resolved value for the life of the process;
   * it is never re-invoked per request.
   */
  readonly loader: () => Promise<LoadedConfig>;
  /** Bounded file-system seam threaded into the sdk calls; defaults to the sdk's real file system. */
  readonly fs?: SdkFs;
  /** Format-adapter registry override threaded into the sdk calls; defaults to the sdk's own registry. */
  readonly adapterRegistry?: NonNullable<CheckDeps["adapterRegistry"]>;
  /** Argument-array process runner for the git-log history view; defaults to a real execFile. */
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
   * Authorizes provider invocations (network egress, an API key read from its environment
   * variable, a billable call). Read once at startup to build the handlers registry; never an
   * RPC parameter. Off (`false`) by default. This is the only capability option: writing a local
   * locale file needs no flag and is always allowed.
   */
  readonly spend?: boolean;
  /** Provider builder for the spend-gated handlers; defaults to the sdk constructing the configured provider. */
  readonly createProvider?: CreateProvider;
  /** Rolling window, in milliseconds, for `translation.retranslateEntry`'s rate limit; tests shrink it to trip the limit deterministically. */
  readonly retranslateRateLimitWindowMs?: number;
  /** Maximum `translation.retranslateEntry` calls allowed within the rolling window before METHOD_RATE_LIMITED. */
  readonly retranslateRateLimitMax?: number;
  /** Rolling window, in milliseconds, for `translation.editEntry`'s rate limit; tests shrink it to trip the limit deterministically. */
  readonly editEntryRateLimitWindowMs?: number;
  /** Maximum `translation.editEntry` calls allowed within the rolling window before METHOD_RATE_LIMITED. */
  readonly editEntryRateLimitMax?: number;
  /** Rolling window, in milliseconds, for `translation.translatePending`'s rate limit; tests shrink it to trip the limit deterministically. */
  readonly translatePendingRateLimitWindowMs?: number;
  /** Maximum `translation.translatePending` calls allowed within the rolling window before METHOD_RATE_LIMITED. */
  readonly translatePendingRateLimitMax?: number;
}

/** Options for starting the studio server: every {@link StudioServerDeps} field, plus the bind port and cwd. */
export interface StudioServerOptions extends StudioServerDeps {
  /** TCP port to bind. Omit for the default Studio port, or pass 0 to let the OS assign an ephemeral port. */
  readonly port?: number;
  /**
   * The project root every RPC handler resolves relative paths against: the locale files, the
   * lock file, and the git repository for the history view. Omit to use `process.cwd()`.
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
