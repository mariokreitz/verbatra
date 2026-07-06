/**
 * Verbatra Studio: a local, read-only web dashboard over a verbatra project, served from a
 * prebuilt single-page app. {@link startUiServer} binds a loopback HTTP server and serves the
 * SPA from the built assets next to this module, or from an injected override. Every request is
 * gated behind a Host and Origin check, a bootstrap token, and a session cookie; the printed
 * loopback URL is the only supported entry point.
 *
 * @packageDocumentation
 */

export { startUiServer } from "./server/create-ui-server.js";
export { DEFAULT_STUDIO_PORT } from "./server/default-port.js";
export type { UiServerErrorCode } from "./server/errors.js";
export { UiServerStartError } from "./server/errors.js";
export type { UiServer, UiServerOptions } from "./server/types.js";
