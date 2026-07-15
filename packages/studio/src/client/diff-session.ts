import type { DiffLocale } from "./diff-view.js";

/**
 * Holds the Diff panel's most recently loaded `status.diff` result, so a sibling component (the
 * command palette) can read the same already-fetched data without a second RPC call. `null` until
 * the Diff panel has successfully loaded at least once in the current session; never cleared once
 * set, so navigating away from the Diff tab and back does not lose the palette's key/locale search
 * index (a plain module-level cache, the same role `sessionStore` plays for session state).
 */
export interface DiffDataStore {
  getState(): readonly DiffLocale[] | null;
  /** Replaces the cached locales; called by the Diff panel after every successful load. */
  setLocales(locales: readonly DiffLocale[]): void;
  subscribe(listener: (locales: readonly DiffLocale[] | null) => void): () => void;
}

/** Creates a fresh {@link DiffDataStore}, starting with no cached data. */
export function createDiffDataStore(): DiffDataStore {
  let state: readonly DiffLocale[] | null = null;
  const listeners = new Set<(locales: readonly DiffLocale[] | null) => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState: () => state,
    setLocales(locales: readonly DiffLocale[]): void {
      state = locales;
      notify();
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Holds a pending "open this key's detail drawer" request, so the command palette (mounted at the
 * app shell, a sibling of the Diff panel, not a descendant) can ask the Diff panel to open a key
 * exactly like a manual click on that key already does, whether or not the Diff panel is currently
 * mounted. `request` always notifies, even for the same key twice in a row, so a repeat palette
 * selection reliably re-opens. The Diff panel clears this on unmount and on a manual drawer close,
 * so leaving the Diff tab never leaves a stale request that would reopen a key on a later, unrelated
 * visit; that is the one property that keeps this indistinguishable from a manual click.
 */
export interface OpenKeyStore {
  getState(): string | null;
  request(keyName: string): void;
  clear(): void;
  subscribe(listener: (keyName: string | null) => void): () => void;
}

/** Creates a fresh {@link OpenKeyStore}, starting with no pending request. */
export function createOpenKeyStore(): OpenKeyStore {
  let state: string | null = null;
  const listeners = new Set<(keyName: string | null) => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState: () => state,
    request(keyName: string): void {
      state = keyName;
      notify();
    },
    clear(): void {
      if (state === null) {
        return;
      }
      state = null;
      notify();
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
