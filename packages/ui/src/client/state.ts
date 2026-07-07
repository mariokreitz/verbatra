/**
 * The session's client-side lifecycle: `active` for the whole life of a loaded page, until an
 * HTTP 401 on POST /rpc flips it to `session-expired` permanently (G22). There is no transition
 * back to `active`; the only way out is a full page reload, which discards this module's state
 * along with everything else.
 */
export type SessionState = { readonly kind: "active" } | { readonly kind: "session-expired" };

/** A minimal observable store for {@link SessionState}, plain TypeScript with no DOM dependency. */
export interface SessionStore {
  getState(): SessionState;
  /**
   * Transitions to `session-expired` and notifies subscribers, unless it already has (idempotent):
   * once expired, the state never changes again for the life of this store.
   */
  markSessionExpired(): void;
  /** Registers a listener called on every state change; returns a function that unregisters it. */
  subscribe(listener: (state: SessionState) => void): () => void;
}

const ACTIVE_STATE: SessionState = { kind: "active" };
const SESSION_EXPIRED_STATE: SessionState = { kind: "session-expired" };

/** Creates a fresh {@link SessionStore}, starting `active`. */
export function createSessionStore(): SessionStore {
  let state: SessionState = ACTIVE_STATE;
  const listeners = new Set<(state: SessionState) => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState: () => state,
    markSessionExpired(): void {
      if (state.kind === "session-expired") {
        return;
      }
      state = SESSION_EXPIRED_STATE;
      notify();
    },
    subscribe(listener: (state: SessionState) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A secret-free, structured error, shaped like an RPC envelope's error field. */
export interface StructuredError {
  readonly code: string;
  readonly message: string;
}

/** The outcome of one refresh-triggered re-fetch; structurally the same shape an `RpcCallResult` already has. */
export type FetchOutcome<T> =
  | { readonly ok: true; readonly result: T }
  | { readonly ok: false; readonly error: StructuredError };

/**
 * A view over one panel's data, generic over the data's shape, that never blanks to a bare loading
 * or error state once it has real data: a live-refresh re-fetch that comes back `ok: false` keeps
 * rendering the last good data, marked `stale`, alongside the new error, and a later refresh event
 * tries again. `error` with no `data` is reserved for a fetch that has never yet succeeded.
 */
export type RefreshableView<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "data"; readonly data: T; readonly stale: false }
  | {
      readonly kind: "data";
      readonly data: T;
      readonly stale: true;
      readonly error: StructuredError;
    }
  | { readonly kind: "error"; readonly error: StructuredError };

/**
 * Applies one fetch outcome to the previous view (G12-driven: live refresh only ever triggers a
 * re-fetch, never carries data itself). A success always replaces the data with fresh data,
 * marked not stale. A failure never blanks a view that already has good data: it keeps that data,
 * marks it `stale`, and carries the new structured error for display; only a failure with no
 * prior data at all (the very first load failed) has nothing to fall back to and renders as a
 * hard error.
 */
export function applyRefreshOutcome<T>(
  previous: RefreshableView<T>,
  outcome: FetchOutcome<T>,
): RefreshableView<T> {
  if (outcome.ok) {
    return { kind: "data", data: outcome.result, stale: false };
  }
  if (previous.kind === "data") {
    return { kind: "data", data: previous.data, stale: true, error: outcome.error };
  }
  return { kind: "error", error: outcome.error };
}
