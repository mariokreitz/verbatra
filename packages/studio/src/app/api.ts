/**
 * The single rpc client, session store, and live-refresh wiring the whole app shares, wired to
 * the real browser `fetch` and `EventSource`. Kept deliberately thin: the actual client,
 * session-expiry, reconnect, and stale-data logic live in `src/client/` (covered by the coverage
 * gate); this module only supplies the DOM-backed implementations and one shared refresh bus.
 */
import {
  createDiffDataStore,
  createOpenKeyStore,
  type DiffDataStore,
  type OpenKeyStore,
} from "../client/diff-session.js";
import type { EventSourceLike, MessageEventLike, ProbeOutcome } from "../client/reconnect.js";
import { createReconnectController } from "../client/reconnect.js";
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

/** The Diff panel's most recently loaded data, read by the command palette to build key/locale targets. */
export const diffDataStore: DiffDataStore = createDiffDataStore();

/** A pending "open this key" request from the command palette, read by the Diff panel. */
export const openKeyStore: OpenKeyStore = createOpenKeyStore();

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
});
