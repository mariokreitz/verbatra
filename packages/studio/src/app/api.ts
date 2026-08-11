/**
 * The single rpc client, session store, and live-refresh wiring the whole app
 * shares, bound to the real browser `fetch` and `EventSource`. The client,
 * session-expiry, reconnect, and overlay logic live in `src/client/`; this
 * module supplies the DOM-backed implementations, one shared refresh bus, and
 * one shared connection-status store.
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
import {
  type AgentToolsStatusStore,
  createAgentToolsStatusStore,
} from "../webmcp/registration-store.js";

const browserFetch: FetchLike = (url, init) => fetch(url, init);

/** The app's single session store, shared by the rpc client and the reconnect controller. */
export const sessionStore: SessionStore = createSessionStore();

/** The app's single rpc client, bound to the browser `fetch` and {@link sessionStore}. */
export const rpcClient: RpcClient = createRpcClient({
  fetchImpl: browserFetch,
  session: sessionStore,
});

/**
 * The review queue's "actioned this session" overlay, held at module scope so
 * it survives a page switch away from and back to the Review panel and resets
 * only on a full page reload.
 */
export const reviewOverlayStore: ReviewOverlayStore = createReviewOverlayStore();

/**
 * The agent-tools registration outcome, held at module scope because the registration pass
 * finishes after the dashboard has already mounted. It stays empty unless a tool registration
 * failed, so nothing renders for the users who never opted the surface in.
 */
export const agentToolsStatusStore: AgentToolsStatusStore = createAgentToolsStatusStore();

/**
 * The teardown handle for the agent-tools surface. Its signal is passed to every `registerTool`
 * call, and aborting it is the only way the WebMCP specification offers to take the tools back:
 * there is no `unregisterTool`. `abort()` is idempotent and never throws, so a caller may invoke
 * it twice or during page teardown safely.
 *
 * Nothing aborts it today. The dashboard mounts once per page load and is never unmounted, and
 * aborting on `pagehide` would be wrong rather than harmless: a back/forward-cache restore brings
 * the same document back with its tools permanently gone, and re-registration is not supported.
 * So the controller exists as the seam a real teardown would use, and stays untouched until there
 * is one.
 */
export const agentToolsAbortController = new AbortController();

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

/** Starts as "reconnecting" until the first SSE connection opens. */
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

/** Deduplicates repeated statuses so subscribers re-render once per actual transition. */
function notifyConnectionStatus(status: ConnectionStatus): void {
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
 * A cheap rpc probe that distinguishes a terminal session expiry from a
 * transient network failure. Any outcome other than the specific
 * session-expired error means "retry with backoff".
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
