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
 * Sized more conservatively than the single-key actions above: every call translates every
 * configured target locale in one shot, the same blast radius as a whole-project translate run.
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
 * Builds the in-flight guard that blocks a second concurrent translatePending call: a resource
 * and UX control only, not a correctness mechanism (see `in-flight-guard.ts`). Built fresh per
 * server instance, mirroring {@link buildRateLimiter}.
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
 * Handles a request the HTTP parser itself rejects, for example a garbled request line. Node
 * would otherwise write its own generic 400 before the request listener ever runs; this replaces
 * that with the same constant 403 body every other transport rejection gets. It does not cover an
 * HTTP/1.1 request with no Host header at all: Node answers that with its own 400 at the protocol
 * level, so neither this handler nor the request listener ever sees it.
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
 * Builds the deps every RPC handler receives. Called once in {@link startStudioServer} with the
 * config that was resolved before listen, and reused for the life of the process: no handler
 * re-loads the config. `spend` is threaded through unchanged so the snapshot handler can project
 * the same resolved boolean `createRpcHandlers` used to build the registry (`writeToDisk` is
 * always true and needs no threading). Optional test seams from `options` are forwarded only when
 * set.
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
 * How long a graceful close waits for the final SSE shutdown frames to flush before destroying
 * the remaining sockets. Loopback flushes within a tick or two; 50ms is comfortably above that
 * while keeping shutdown effectively instant for a human.
 */
const SHUTDOWN_FLUSH_GRACE_MS = 50;

/**
 * Shuts the server down in a pinned order. The SSE hub closes first, writing a final shutdown
 * frame to every open connection and ending each response, so in-flight streams end cleanly
 * instead of being cut off mid-frame by `closeAllConnections`. A short grace period follows:
 * destroying every connection in the same tick would discard the just-written shutdown frames
 * from the ended sockets' write buffers, and a browser would then see only a dropped connection
 * and reconnect forever instead of showing the session-expired notice. The project watcher is
 * stopped concurrently with the HTTP server's own close; both must settle before this resolves,
 * so no watcher handle outlives the server.
 */
async function closeServer(server: Server, sseHub: SseHub, watcher: ProjectWatcher): Promise<void> {
  sseHub.closeAll();
  await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_FLUSH_GRACE_MS));
  const serverClosed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
  await Promise.all([serverClosed, watcher.close()]);
}

/**
 * Starts the local Verbatra Studio server: a loopback-only HTTP server that serves the prebuilt
 * SPA and gates every request behind a Host and Origin check, a bootstrap token, and a session
 * cookie. There is no host option and no relaxed mode; the printed loopback URL, shown once at
 * startup, is the only supported entry point.
 *
 * `options.loader` is resolved exactly once here, before the server starts listening: every RPC
 * handler for the life of this process receives that same resolved config, and the loader is
 * never re-invoked on a later request. Capabilities are fixed even earlier, before the loader
 * runs: `writeToDisk` is always true, and `spend` is granted only when `options.spend` is set, so
 * nothing the loader does can change what this process was granted.
 *
 * Every RPC handler resolves relative paths against `options.cwd` when given, or `process.cwd()`
 * otherwise; see {@link StudioServerOptions.cwd}.
 */
export async function startStudioServer(options: StudioServerOptions): Promise<StudioServer> {
  const assetsRootPath = fileURLToPath(options.assetsRoot ?? defaultAssetsRoot());
  const output = options.output ?? defaultOutput;
  const token = options.token ?? generateToken();
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
