/** One flagged row's identity: a target locale paired with the source key it flags. */
export interface ReviewOverlayEntry {
  readonly locale: string;
  readonly key: string;
}

function entryKey(entry: ReviewOverlayEntry): string {
  return `${entry.locale}\0${entry.key}`;
}

/**
 * The client's "actioned this session" overlay: a plain, synchronous, in-memory store, never a
 * browser-persisted storage API and never backed by any server call (per structural ruling 2 in
 * the needs-review-queue spec). Approve, reject, and a successfully accepted edit all call
 * {@link markActioned}; every fresh `review.queue` read, including one triggered by the existing
 * SSE `refresh` event, is filtered through {@link isActioned} before rendering, so an actioned row
 * does not reappear within the same page session. A fresh instance (created on page reload, since
 * this module's state lives only in the running page's memory) starts with nothing actioned; this
 * is the "resets on reload" behavior by construction, not a feature implemented separately.
 *
 * Deliberately has no method that is asynchronous or returns a deferred value, and never imports
 * the shared request client or any transport: the type signature alone proves it cannot reach the
 * network, matching this module's own static proof test.
 */
export interface ReviewOverlayStore {
  isActioned(entry: ReviewOverlayEntry): boolean;
  /** Idempotent: marking an already-actioned entry again is a no-op, including for subscribers. */
  markActioned(entry: ReviewOverlayEntry): void;
  /** Registers a listener called after a state change; returns a function that unregisters it. */
  subscribe(listener: () => void): () => void;
}

/** Creates a fresh {@link ReviewOverlayStore}, starting with nothing actioned. */
export function createReviewOverlayStore(): ReviewOverlayStore {
  const actioned = new Set<string>();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    isActioned: (entry: ReviewOverlayEntry): boolean => actioned.has(entryKey(entry)),
    markActioned(entry: ReviewOverlayEntry): void {
      const key = entryKey(entry);
      if (actioned.has(key)) {
        return;
      }
      actioned.add(key);
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
