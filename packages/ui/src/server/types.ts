/**
 * Options accepted by {@link startUiServer}. The option set grows as the server gains its
 * request-validation gate (host, origin, cookie, token checks, and response headers); this
 * scaffold wires the assets-root override end to end so the SPA can be served from anywhere.
 */
export interface UiServerOptions {
  /** TCP port to bind. Omit, or pass 0, to let the OS assign an ephemeral port. */
  readonly port?: number;
  /** Bootstrap token the server will accept once request validation lands. */
  readonly token?: string;
  /** Overrides where static assets are served from; defaults to the built SPA next to this module. */
  readonly assetsRoot?: URL;
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
