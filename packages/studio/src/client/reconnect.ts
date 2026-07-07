/**
 * The client-side reconnect controller for the live-refresh SSE stream (G22/G23). It owns the
 * lifecycle of one `EventSource`-like connection: it forwards "refresh" events, treats the
 * server's "shutdown" event as permanent (the shared session store is marked expired, reusing the
 * exact same terminal state and UI the 401 path already uses, never a second parallel mechanism),
 * and on a native connection error whose `readyState` is `CLOSED` probes the server with one
 * cheap RPC call: a 401 probe raises that same shared terminal state and halts permanently; a
 * network-failure probe schedules the next reconnect attempt with exponential backoff (base 1s,
 * factor 2, capped at 30s). A `readyState` other than `CLOSED` means the connection is still
 * trying on its own, so this controller does nothing and lets it continue.
 */
import type { RefreshEvent } from "../shared/sse-events.js";
import { SSE_EVENT_REFRESH, SSE_EVENT_SHUTDOWN } from "../shared/sse-events.js";
import type { SessionStore } from "./state.js";

/** `EventSource.readyState` value meaning the connection has given up and will not retry on its own. */
export const EVENT_SOURCE_CLOSED = 2;

/** The minimal message-event shape this module reads: only the raw text payload. */
export interface MessageEventLike {
  readonly data: string;
}

/** The minimal `EventSource` surface this module depends on, so a fake never needs the DOM lib. */
export interface EventSourceLike {
  readonly readyState: number;
  addEventListener(type: string, listener: (event: MessageEventLike) => void): void;
  close(): void;
}

/** Builds an {@link EventSourceLike} for the given URL; production wraps the real browser global. */
export type CreateEventSource = (url: string) => EventSourceLike;

/** The two outcomes a reconnect probe distinguishes; everything that is not a 401 counts as a network error. */
export type ProbeOutcome = "unauthorized" | "network-error";

/** Runs one cheap RPC call solely to distinguish a terminal 401 from a transient network failure. */
export type ProbeFn = () => Promise<ProbeOutcome>;

/** Options for {@link createReconnectController}. */
export interface ReconnectControllerOptions {
  /** The `/events` URL to connect to. */
  readonly url: string;
  readonly createEventSource: CreateEventSource;
  readonly probe: ProbeFn;
  readonly session: SessionStore;
  /** Called once per refresh event received on the current connection. */
  readonly onRefresh: (event: RefreshEvent) => void;
  /** Base backoff delay in milliseconds; defaults to 1000 (1 second). */
  readonly baseDelayMs?: number;
  /** Backoff cap in milliseconds; defaults to 30000 (30 seconds). */
  readonly maxDelayMs?: number;
}

/** Handle returned by {@link createReconnectController}. */
export interface ReconnectController {
  /** Closes the current connection and cancels any pending reconnect attempt, without touching session state. */
  stop(): void;
}

const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30_000;
const BACKOFF_FACTOR = 2;

function computeBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  return Math.min(baseDelayMs * BACKOFF_FACTOR ** attempt, maxDelayMs);
}

/** Parses one SSE `refresh` frame's data; malformed data is dropped rather than thrown. */
function parseRefreshEvent(data: string): RefreshEvent | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const { reason, at } = parsed as { reason?: unknown; at?: unknown };
  if (
    (reason === "source" || reason === "targets" || reason === "lock") &&
    typeof at === "string"
  ) {
    return { reason, at };
  }
  return undefined;
}

/**
 * Starts and owns one live-refresh connection. Every later reconnect after a terminal `CLOSED`
 * error goes through the same probe-and-backoff decision; a successful reconnect resets the
 * backoff attempt counter, so a later, unrelated disconnect starts fresh at the base delay again.
 */
export function createReconnectController(
  options: ReconnectControllerOptions,
): ReconnectController {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let stopped = false;
  let attempt = 0;
  let current: EventSourceLike | undefined;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;

  function clearPendingTimer(): void {
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer);
      pendingTimer = undefined;
    }
  }

  function handleRefresh(event: MessageEventLike): void {
    const refreshEvent = parseRefreshEvent(event.data);
    if (refreshEvent !== undefined) {
      options.onRefresh(refreshEvent);
    }
  }

  function handleShutdown(): void {
    stopped = true;
    clearPendingTimer();
    current?.close();
    current = undefined;
    options.session.markSessionExpired();
  }

  function scheduleReconnect(): void {
    const delay = computeBackoffDelay(attempt, baseDelayMs, maxDelayMs);
    attempt += 1;
    pendingTimer = setTimeout(() => {
      pendingTimer = undefined;
      connect();
    }, delay);
  }

  async function probeAndMaybeReconnect(): Promise<void> {
    const outcome = await options.probe();
    if (stopped) {
      return;
    }
    if (outcome === "unauthorized") {
      stopped = true;
      options.session.markSessionExpired();
      return;
    }
    scheduleReconnect();
  }

  function handleError(source: EventSourceLike): void {
    if (stopped || source.readyState !== EVENT_SOURCE_CLOSED) {
      return;
    }
    source.close();
    void probeAndMaybeReconnect();
  }

  function handleOpen(): void {
    attempt = 0;
  }

  function connect(): void {
    if (stopped) {
      return;
    }
    const source = options.createEventSource(options.url);
    current = source;
    source.addEventListener("open", handleOpen);
    source.addEventListener(SSE_EVENT_REFRESH, handleRefresh);
    source.addEventListener(SSE_EVENT_SHUTDOWN, handleShutdown);
    source.addEventListener("error", () => handleError(source));
  }

  connect();

  return {
    stop(): void {
      stopped = true;
      clearPendingTimer();
      current?.close();
      current = undefined;
    },
  };
}
