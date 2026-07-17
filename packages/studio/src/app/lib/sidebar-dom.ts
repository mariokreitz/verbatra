/**
 * Persistence for the desktop sidebar's collapsed state: best-effort
 * localStorage reads and writes that never throw.
 */

const SIDEBAR_STORAGE_KEY = "verbatra-studio-sidebar";

/** Reads the stored collapsed state; expanded (false) for a first visit or an unreadable store. */
export function readStoredSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** Persists the collapsed state; swallows storage errors, so the choice may not survive a reload. */
export function storeSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {}
}
