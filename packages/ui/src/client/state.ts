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
