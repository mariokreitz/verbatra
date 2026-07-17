/**
 * Verbatra Studio: a local web dashboard over a verbatra project, served from a prebuilt
 * single-page app. It is read-focused (drift status, diffs, integrity, history, the review
 * queue), with two write seams: editing a single entry locally is always available, and
 * provider-calling retranslation is registered only when the spend capability is granted at
 * startup. {@link startStudioServer} binds a loopback HTTP server and serves the SPA from the
 * built assets next to this module, or from an injected override. Every request is gated behind
 * a Host and Origin check, a bootstrap token, and a session cookie; the printed loopback URL is
 * the only supported entry point.
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
