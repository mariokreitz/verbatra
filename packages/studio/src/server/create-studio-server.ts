import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { fileURLToPath } from "node:url";
import type { LoadedConfig } from "@verbatra/sdk";
import { EDIT_ENTRY_METHOD } from "../shared/rpc/edit-entry.js";
import { RETRANSLATE_ENTRY_METHOD } from "../shared/rpc/retranslate-entry.js";
import { TRANSLATE_PENDING_METHOD } from "../shared/rpc/translate-pending.js";
import { buildBanner } from "./banner.js";
import { cookieName } from "./cookie.js";
import { resolvePort } from "./default-port.js";
import { type DispatchContext, handleRequest } from "./dispatch.js";
import { StudioServerStartError } from "./errors.js";
import { createRpcInFlightGuard, type RpcInFlightGuard } from "./in-flight-guard.js";
import { createRpcRateLimiter, type RpcRateLimiter } from "./rate-limiter.js";
import { resolveBoundAddress } from "./resolve-bound-port.js";
import { createRpcHandlers, type RpcHandlerDeps, type StudioCapabilities } from "./rpc.js";
import { createSseHub, type SseHub } from "./sse.js";
import { generateToken } from "./token.js";
import { FORBIDDEN_BODY } from "./transport-responses.js";
import type { StudioServer, StudioServerOptions } from "./types.js";
import {
  createProjectWatcher,
  defaultCreateStudioWatcher,
  type ProjectWatcher,
} from "./watcher.js";

/** Production default: 20 calls per rolling minute, generous for a human clicking one action repeatedly. */
const DEFAULT_RETRANSLATE_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RETRANSLATE_RATE_LIMIT_MAX = 20;
/** Same production default as retranslate: 20 calls per rolling minute. */
const DEFAULT_EDIT_ENTRY_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_EDIT_ENTRY_RATE_LIMIT_MAX = 20;
/**
 * Sized more conservatively than the single-key actions above: every call now necessarily
 * translates every configured target locale in one shot, the same blast radius the CLI's own
 * whole-project translate command already has, newly reachable with one click.
 */
const DEFAULT_TRANSLATE_PENDING_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_TRANSLATE_PENDING_RATE_LIMIT_MAX = 5;

function buildRateLimiter(options: StudioServerOptions): RpcRateLimiter {
  return createRpcRateLimiter({
    [RETRANSLATE_ENTRY_METHOD]: {
      windowMs: options.retranslateRateLimitWindowMs ?? DEFAULT_RETRANSLATE_RATE_LIMIT_WINDOW_MS,
      maxCalls: options.retranslateRateLimitMax ?? DEFAULT_RETRANSLATE_RATE_LIMIT_MAX,
    },
    [EDIT_ENTRY_METHOD]: {
      windowMs: options.editEntryRateLimitWindowMs ?? DEFAULT_EDIT_ENTRY_RATE_LIMIT_WINDOW_MS,
      maxCalls: options.editEntryRateLimitMax ?? DEFAULT_EDIT_ENTRY_RATE_LIMIT_MAX,
    },
    [TRANSLATE_PENDING_METHOD]: {
      windowMs:
        options.translatePendingRateLimitWindowMs ?? DEFAULT_TRANSLATE_PENDING_RATE_LIMIT_WINDOW_MS,
      maxCalls: options.translatePendingRateLimitMax ?? DEFAULT_TRANSLATE_PENDING_RATE_LIMIT_MAX,
    },
  });
}

/**
 * A single process-wide "a translatePending run is currently in flight" guard: a resource/UX
 * control only, not the correctness fix (see `in-flight-guard.ts`'s own doc comment). Built fresh
 * per server instance, mirroring {@link buildRateLimiter}.
 */
function buildInFlightGuard(): RpcInFlightGuard {
  return createRpcInFlightGuard(new Set([TRANSLATE_PENDING_METHOD]));
}

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
 * Builds the deps every RPC handler receives, resolved once here (see the `loader` call in
 * {@link startStudioServer}, before listen) and reused for the life of the process (G11/G12): no
 * handler re-loads the config, and the server otherwise caches no project data between requests.
 * `spend` is threaded through unchanged so `project.snapshot`'s handler can build the read-only
 * `capabilities` projection from the same resolved boolean `createRpcHandlers` used to build the
 * registry itself (`writeToDisk` is always true and needs no threading).
 */
function buildRpcHandlerDeps(
  config: LoadedConfig,
  projectRoot: string,
  capabilities: StudioCapabilities,
  options: StudioServerOptions,
): RpcHandlerDeps {
  return {
    config,
    projectRoot,
    spend: capabilities.spend,
    ...(options.fs !== undefined ? { fs: options.fs } : {}),
    ...(options.adapterRegistry !== undefined ? { adapterRegistry: options.adapterRegistry } : {}),
    ...(options.execFileImpl !== undefined ? { execFileImpl: options.execFileImpl } : {}),
    ...(options.createWatcher !== undefined ? { createWatcher: options.createWatcher } : {}),
    ...(options.heartbeatIntervalMs !== undefined
      ? { heartbeatIntervalMs: options.heartbeatIntervalMs }
      : {}),
    ...(options.createProvider !== undefined ? { createProvider: options.createProvider } : {}),
  };
}

/**
 * Confirms the server actually bound the loopback address it asked for. In practice this always
 * holds since the server is only ever told to listen on "127.0.0.1", but every downstream check
 * (Host, Origin, the cookie name) depends on it, so it is asserted explicitly rather than assumed.
 */
export function assertLoopbackAddress(address: AddressInfo): void {
  if (address.address !== "127.0.0.1") {
    throw new StudioServerStartError(
      "BIND_FAILED",
      address.port,
      "verbatra studio server did not bind to 127.0.0.1",
    );
  }
}

function listen(server: Server, port: number): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(new StudioServerStartError("PORT_IN_USE", port, `port ${port} is already in use`));
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

/**
 * Shuts the server down in the pinned order (G23): the SSE hub's close, which writes a final
 * shutdown frame to every open connection and ends each response, runs first, so in-flight
 * streams end cleanly instead of being cut off mid-frame by `closeAllConnections` below. The
 * project watcher is stopped concurrently with the HTTP server's own close; neither depends on
 * the other, but both must settle before this resolves, so no chokidar handle outlives the server.
 */
function closeServer(server: Server, sseHub: SseHub, watcher: ProjectWatcher): Promise<void> {
  sseHub.closeAll();
  const serverClosed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
  return Promise.all([serverClosed, watcher.close()]).then(() => undefined);
}

/**
 * Starts the local Verbatra Studio server: a loopback-only HTTP server that serves the prebuilt
 * SPA and gates every request behind a Host and Origin check, a bootstrap token, and a session
 * cookie. There is no host option and no relaxed mode; the printed loopback URL, shown once at
 * startup, is the only supported entry point.
 *
 * `options.loader` is resolved exactly once here, before the server starts listening (G11): every
 * RPC handler for the life of this process receives that same resolved config, and it is never
 * re-invoked on a later request, whatever the request does.
 *
 * Every RPC handler resolves relative paths against `options.cwd` when given, or `process.cwd()`
 * otherwise; see {@link StudioServerOptions.cwd}.
 */
export async function startStudioServer(options: StudioServerOptions): Promise<StudioServer> {
  const assetsRootPath = fileURLToPath(options.assetsRoot ?? defaultAssetsRoot());
  const output = options.output ?? defaultOutput;
  const token = options.token ?? generateToken();
  // Fixed before the config loader ever runs (G11-style ordering, matching how token/loader/cwd
  // are resolved once): nothing the loader or the project's own config module does can feed back
  // into which capabilities this process was granted. `writeToDisk` is always true (local editing
  // needs no flag); only `spend` remains an opt-in.
  const capabilities: StudioCapabilities = {
    spend: options.spend ?? false,
    writeToDisk: true,
  };
  const config = await options.loader();
  const projectRoot = options.cwd ?? process.cwd();

  const watcher = await createProjectWatcher(
    { config: config.config, projectRoot },
    {
      createWatcher: options.createWatcher ?? defaultCreateStudioWatcher,
      ...(options.fs !== undefined ? { fs: options.fs } : {}),
      ...(options.adapterRegistry !== undefined
        ? { adapterRegistry: options.adapterRegistry }
        : {}),
    },
  );
  const sseHub = createSseHub(
    options.heartbeatIntervalMs !== undefined
      ? { heartbeatIntervalMs: options.heartbeatIntervalMs }
      : {},
  );
  watcher.onRefresh((event) => sseHub.broadcastRefresh(event));

  // Built once, before listen(): a spend-gated method a server was not granted is simply absent
  // from the returned registry, never rebuilt or re-derived for the life of the process.
  const handlers = createRpcHandlers(capabilities);
  const rateLimiter = buildRateLimiter(options);
  const inFlightGuard = buildInFlightGuard();

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
    rpcDeps: buildRpcHandlerDeps(config, projectRoot, capabilities, options),
    handlers,
    rateLimiter,
    inFlightGuard,
    sseHub,
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
    close: () => closeServer(server, sseHub, watcher),
  };
}
