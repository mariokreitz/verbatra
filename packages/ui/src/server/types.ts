/**
 * Options accepted by {@link startUiServer}. Dev ergonomics come only from the injected token and
 * the assets-root override; nothing here varies request validation by environment.
 */
export interface UiServerOptions {
  /** TCP port to bind. Omit for the default Studio port, or pass 0 to let the OS assign an ephemeral port (tests only). */
  readonly port?: number;
  /** Bootstrap token the server accepts. Omit to have the server generate one from secure randomness. */
  readonly token?: string;
  /** Overrides where static assets are served from; defaults to the built SPA next to this module. */
  readonly assetsRoot?: URL;
  /** Sink for the startup banner and the per-request log line. Defaults to writing to the console. */
  readonly output?: (line: string) => void;
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
