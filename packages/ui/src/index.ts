/**
 * Verbatra Studio: a local, read-only web dashboard over a verbatra project, served from a
 * prebuilt single-page app. {@link startUiServer} binds a loopback HTTP server and serves the
 * SPA from the built assets next to this module, or from an injected override.
 *
 * @packageDocumentation
 */

export { startUiServer } from "./server/create-ui-server.js";
export type { UiServer, UiServerOptions } from "./server/types.js";
