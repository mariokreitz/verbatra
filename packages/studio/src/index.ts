/**
 * Verbatra Studio: a local, read-only web dashboard over a verbatra project, served from a
 * prebuilt single-page app. {@link startStudioServer} binds a loopback HTTP server and serves the
 * SPA from the built assets next to this module, or from an injected override. Every request is
 * gated behind a Host and Origin check, a bootstrap token, and a session cookie; the printed
 * loopback URL is the only supported entry point.
 *
 * @packageDocumentation
 */

export { startStudioServer } from "./server/create-studio-server.js";
export { DEFAULT_STUDIO_PORT } from "./server/default-port.js";
export type { StudioServerErrorCode } from "./server/errors.js";
export { StudioServerStartError } from "./server/errors.js";
export type {
  CreateStudioWatcher,
  ExecFileImpl,
  ExecFileResult,
  StudioServer,
  StudioServerDeps,
  StudioServerOptions,
  StudioWatcher,
} from "./server/types.js";
