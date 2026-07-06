import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { buildBanner } from "./banner.js";
import { cookieName } from "./cookie.js";
import { resolvePort } from "./default-port.js";
import { type DispatchContext, handleRequest } from "./dispatch.js";
import { UiServerStartError } from "./errors.js";
import { resolveBoundAddress } from "./resolve-bound-port.js";
import { generateToken } from "./token.js";
import { FORBIDDEN_BODY } from "./transport-responses.js";
import type { UiServer, UiServerOptions } from "./types.js";

const RAW_FORBIDDEN_RESPONSE = [
  "HTTP/1.1 403 Forbidden",
  "Content-Type: text/plain; charset=utf-8",
  `Content-Length: ${Buffer.byteLength(FORBIDDEN_BODY)}`,
  "Connection: close",
  "",
  FORBIDDEN_BODY,
].join("\r\n");

/**
 * Handles a request the HTTP parser itself rejects, for example a garbled request line. Node's
 * default behavior for these is to write its own generic 400 response before the request listener
 * ever runs; this replaces that with the same constant 403 body every other transport rejection
 * gets. This does not cover a genuinely missing Host header: an HTTP/1.1 request with no Host
 * header at all is intercepted by Node's own HTTP server at the protocol level, answered with
 * Node's own 400, and never reaches this handler or the request listener. The request listener's
 * own Host check only ever sees a Host header that is present but wrong, for example
 * "localhost:1234" or an explicitly empty value, and answers those with the same constant 403
 * body.
 */
function handleClientError(_error: Error, socket: Socket): void {
  if (socket.writable) {
    socket.end(RAW_FORBIDDEN_RESPONSE);
  } else {
    socket.destroy();
  }
}

function defaultAssetsRoot(): URL {
  return new URL("./app/", import.meta.url);
}

function defaultOutput(line: string): void {
  console.log(line);
}

/**
 * Confirms the server actually bound the loopback address it asked for. In practice this always
 * holds since the server is only ever told to listen on "127.0.0.1", but every downstream check
 * (Host, Origin, the cookie name) depends on it, so it is asserted explicitly rather than assumed.
 */
export function assertLoopbackAddress(address: AddressInfo): void {
  if (address.address !== "127.0.0.1") {
    throw new UiServerStartError(
      "BIND_FAILED",
      address.port,
      "verbatra ui server did not bind to 127.0.0.1",
    );
  }
}

function listen(server: Server, port: number): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(new UiServerStartError("PORT_IN_USE", port, `port ${port} is already in use`));
        return;
      }
      /* v8 ignore next -- other bind failures (for example EACCES on a privileged port) are OS and environment dependent and not reliably reproducible in a test */
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      /* v8 ignore next 5 -- server.address() is only null or a pipe path before listen resolves or after close; neither applies inside this callback */
      try {
        resolve(resolveBoundAddress(server.address()));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ordering slot for a future live-refresh event stream: its own close (a close frame sent to
    // every open connection) must run before this, so in-flight streams end cleanly instead of
    // being cut off mid-frame by closeAllConnections below.
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

/**
 * Starts the local Verbatra Studio server: a loopback-only HTTP server that serves the prebuilt
 * SPA and gates every request behind a Host and Origin check, a bootstrap token, and a session
 * cookie. There is no host option and no relaxed mode; the printed loopback URL, shown once at
 * startup, is the only supported entry point.
 */
export async function startUiServer(options: UiServerOptions = {}): Promise<UiServer> {
  const assetsRootPath = fileURLToPath(options.assetsRoot ?? defaultAssetsRoot());
  const output = options.output ?? defaultOutput;
  const token = options.token ?? generateToken();

  const server = createServer();
  server.on("clientError", handleClientError);
  const address = await listen(server, resolvePort(options.port));
  assertLoopbackAddress(address);
  const port = address.port;

  const context: DispatchContext = {
    port,
    token,
    cookieName: cookieName(port),
    assetsRootPath,
    log: output,
  };
  server.on("request", (request, response) => {
    handleRequest(context, request, response).catch(() => {
      // A genuine transport failure, such as the client aborting an upload mid-body, has already
      // left the connection unusable; there is nothing safe left to write, so it is torn down
      // without leaking anything about the failure.
      request.destroy();
      response.destroy();
    });
  });

  const url = `http://127.0.0.1:${port}/`;
  output(buildBanner(url, token));

  return {
    url,
    port,
    close: () => closeServer(server),
  };
}
