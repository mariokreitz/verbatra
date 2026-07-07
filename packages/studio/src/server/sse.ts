/**
 * The SSE hub: tracks every currently connected `GET /events` client and writes payload-free
 * refresh events, periodic heartbeats, and the final shutdown frame to all of them. A client is
 * deregistered the moment its response emits "close" or "error", or the moment a write to it
 * fails (for example a destroyed socket); no error from any of that ever escapes as an uncaught
 * exception or an unhandled rejection, since every write goes through {@link tryWrite}.
 */
import type { RefreshEvent, ShutdownEvent } from "../shared/sse-events.js";
import { SSE_EVENT_REFRESH, SSE_EVENT_SHUTDOWN } from "../shared/sse-events.js";
import { redact } from "./redaction.js";

/** Default interval between heartbeat frames; overridden by {@link StudioServerDeps.heartbeatIntervalMs} in tests. */
const DEFAULT_HEARTBEAT_MS = 15_000;

/**
 * The minimal response surface the hub needs: writing frames, ending the stream, and observing
 * "close" or "error". Declared independently of `node:http`'s `ServerResponse` (rather than
 * `Pick`-ing from it) so a plain fake object satisfies it in tests without fighting the real
 * class's `this`-typed return values; a real `ServerResponse` still satisfies this structurally.
 */
export interface SseClientResponse {
  write(chunk: string): boolean;
  end(): void;
  once(event: "close" | "error", listener: (...args: unknown[]) => void): void;
}

/** The live-refresh SSE hub: register clients, broadcast refresh events, and shut down cleanly. */
export interface SseHub {
  /** Registers one client's response, writing nothing itself; the caller writes the initial headers. */
  register(response: SseClientResponse): void;
  /** Writes a refresh event to every currently registered client; a failed write deregisters it. */
  broadcastRefresh(event: RefreshEvent): void;
  /** Writes a final shutdown frame to every client, ends each response, and stops the heartbeat. */
  closeAll(): void;
  /** The number of currently registered clients. */
  readonly size: number;
}

/** Writes one SSE frame, redacted as a defense-in-depth backstop; never throws. */
function tryWrite(response: SseClientResponse, event: string, data: unknown): boolean {
  const frame = redact(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    return response.write(frame);
  } catch {
    return false;
  }
}

/** Writes a heartbeat comment line; a comment is never dispatched as a named event to the client. */
function tryWriteHeartbeat(response: SseClientResponse): boolean {
  try {
    return response.write(`: heartbeat ${Date.now()}\n\n`);
  } catch {
    return false;
  }
}

/** Ends a response defensively; an already-destroyed stream must never throw out of shutdown. */
function tryEnd(response: SseClientResponse): void {
  try {
    response.end();
  } catch {
    // Already torn down; there is nothing left to end.
  }
}

/** Options for {@link createSseHub}. */
export interface SseHubOptions {
  /** Interval between heartbeat frames; injectable so tests never wait a real production interval. */
  readonly heartbeatIntervalMs?: number;
}

/**
 * Builds a fresh SSE hub with its own heartbeat timer. The timer keeps running until
 * {@link SseHub.closeAll} is called; a server that never calls it would leak the interval, so
 * `closeAll` is always the counterpart to starting the hub.
 */
export function createSseHub(options: SseHubOptions = {}): SseHub {
  const clients = new Set<SseClientResponse>();

  function deregister(response: SseClientResponse): void {
    clients.delete(response);
  }

  function register(response: SseClientResponse): void {
    clients.add(response);
    response.once("close", () => deregister(response));
    response.once("error", () => deregister(response));
  }

  function broadcastRefresh(event: RefreshEvent): void {
    for (const response of clients) {
      if (!tryWrite(response, SSE_EVENT_REFRESH, event)) {
        deregister(response);
      }
    }
  }

  function tickHeartbeat(): void {
    for (const response of clients) {
      if (!tryWriteHeartbeat(response)) {
        deregister(response);
      }
    }
  }

  const heartbeatTimer = setInterval(
    tickHeartbeat,
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS,
  );
  heartbeatTimer.unref?.();

  function closeAll(): void {
    clearInterval(heartbeatTimer);
    const shutdownEvent: ShutdownEvent = { at: new Date().toISOString() };
    for (const response of clients) {
      tryWrite(response, SSE_EVENT_SHUTDOWN, shutdownEvent);
      tryEnd(response);
    }
    clients.clear();
  }

  return {
    register,
    broadcastRefresh,
    closeAll,
    get size(): number {
      return clients.size;
    },
  };
}
