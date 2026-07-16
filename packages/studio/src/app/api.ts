/**
 * The single rpc client, session store, and live-refresh wiring the whole app shares, wired to
 * the real browser `fetch` and `EventSource`. Kept deliberately thin: the actual client,
 * session-expiry, reconnect, and stale-data logic live in `src/client/` (covered by the coverage
 * gate); this module only supplies the DOM-backed implementations, one shared refresh bus, and
 * one shared connection-status store for the live indicator.
 */
import type {
  ConnectionStatus,
  EventSourceLike,
  MessageEventLike,
  ProbeOutcome,
} from "../client/reconnect.js";
import { createReconnectController } from "../client/reconnect.js";
import { createReviewOverlayStore, type ReviewOverlayStore } from "../client/review-overlay.js";
import type { FetchLike, RpcClient } from "../client/rpc-client.js";
import { createRpcClient } from "../client/rpc-client.js";
import { createSessionStore, type SessionStore } from "../client/state.js";
import type { RefreshEvent } from "../shared/sse-events.js";

const browserFetch: FetchLike = (url, init) => fetch(url, init);

export const sessionStore: SessionStore = createSessionStore();

export const rpcClient: RpcClient = createRpcClient({
  fetchImpl: browserFetch,
  session: sessionStore,
});

/**
 * The needs-review queue's "actioned this session" overlay, held at module scope (like
 * {@link sessionStore} above) rather than inside the Review panel component: it must survive a
 * page switch away from and back to the panel, and reset only on a full page reload, which
 * re-runs this module and creates a fresh store. A component-local `useState` would incorrectly
 * reset on every unmount instead.
 */
export const reviewOverlayStore: ReviewOverlayStore = createReviewOverlayStore();

const refreshListeners = new Set<(event: RefreshEvent) => void>();

/** Lets a panel react to a live-refresh event without threading the reconnect controller through props. */
export const refreshBus = {
  subscribe(listener: (event: RefreshEvent) => void): () => void {
    refreshListeners.add(listener);
    return () => {
      refreshListeners.delete(listener);
    };
  },
};

function notifyRefresh(event: RefreshEvent): void {
  for (const listener of refreshListeners) {
    listener(event);
  }
}

const connectionListeners = new Set<(status: ConnectionStatus) => void>();
// "reconnecting" until the first connection opens: the indicator starts amber for the brief
// moment before the SSE stream is up, then turns live and stays truthful thereafter.
let connectionStatus: ConnectionStatus = "reconnecting";

/** The live-refresh connection's current state, for the top bar's live indicator. */
export const connectionStore = {
  getStatus(): ConnectionStatus {
    return connectionStatus;
  },
  subscribe(listener: (status: ConnectionStatus) => void): () => void {
    connectionListeners.add(listener);
    return () => {
      connectionListeners.delete(listener);
    };
  },
};

function notifyConnectionStatus(status: ConnectionStatus): void {
  // The controller re-emits "reconnecting" on every error event during a native EventSource
  // retry loop; deduplicate so subscribers re-render once per actual transition.
  if (status === connectionStatus) {
    return;
  }
  connectionStatus = status;
  for (const listener of connectionListeners) {
    listener(status);
  }
}

function browserCreateEventSource(url: string): EventSourceLike {
  const source = new EventSource(url);
  return {
    get readyState(): number {
      return source.readyState;
    },
    addEventListener(type: string, listener: (event: MessageEventLike) => void): void {
      source.addEventListener(type, (event) => {
        const data = "data" in event && typeof event.data === "string" ? event.data : "";
        listener({ data });
      });
    },
    close: (): void => source.close(),
  };
}

/**
 * A cheap RPC probe used only to distinguish a terminal 401 from a transient network failure
 * (see `client/reconnect.ts`). Any reachable response that is not that specific session-expired
 * error is treated the same as a network error: both simply mean "retry with backoff", and the
 * distinction only matters for the terminal case.
 */
async function probeSession(): Promise<ProbeOutcome> {
  try {
    const result = await rpcClient.call("project.snapshot", {});
    if (!result.ok && result.error.code === "SESSION_EXPIRED") {
      return "unauthorized";
    }
    return "network-error";
  } catch {
    return "network-error";
  }
}

createReconnectController({
  url: "/events",
  createEventSource: browserCreateEventSource,
  probe: probeSession,
  session: sessionStore,
  onRefresh: notifyRefresh,
  onStatusChange: notifyConnectionStatus,
});
