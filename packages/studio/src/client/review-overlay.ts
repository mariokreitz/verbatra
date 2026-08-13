export interface ReviewOverlayEntry {
  readonly locale: string;
  readonly key: string;
}

function entryKey(entry: ReviewOverlayEntry): string {
  return `${entry.locale}\0${entry.key}`;
}

export interface ReviewOverlayStore {
  isActioned(entry: ReviewOverlayEntry): boolean;
  markActioned(entry: ReviewOverlayEntry): void;
  subscribe(listener: () => void): () => void;
}

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
