import type { RefreshEvent, ShutdownEvent } from "../shared/sse-events.js";
import { SSE_EVENT_REFRESH, SSE_EVENT_SHUTDOWN } from "../shared/sse-events.js";
import { redact } from "./redaction.js";

/** Default interval between heartbeat frames when {@link SseHubOptions.heartbeatIntervalMs} is not given. */
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

/**
 * The SSE hub over the GET /events clients: registers connected responses, broadcasts refresh
 * events, writes periodic heartbeats, and shuts every stream down cleanly. A client is
 * deregistered the moment its response emits "close" or "error", or the moment a write to it
 * fails; no error from any of that escapes as an uncaught exception or an unhandled rejection.
 */
export interface SseHub {
  /** Registers one client's response, writing nothing itself; the caller writes the initial headers. */
  register(response: SseClientResponse): void;
  /** Writes a refresh event to every currently registered client; a failed write deregisters that client. */
  broadcastRefresh(event: RefreshEvent): void;
  /** Writes a final shutdown frame to every client, ends each response, and stops the heartbeat timer. */
  closeAll(): void;
  /** The number of currently registered clients. */
  readonly size: number;
}

/** Writes one SSE frame, redacted as a defense-in-depth backstop; returns false instead of throwing. */
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
  } catch {}
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
