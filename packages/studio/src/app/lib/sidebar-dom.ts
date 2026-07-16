/**
 * Persistence for the desktop sidebar's collapsed state, mirroring `theme-dom.ts`'s pattern:
 * best-effort localStorage reads and writes that never throw. Expanded is the default for a
 * first visit or an unreadable store.
 */

const SIDEBAR_STORAGE_KEY = "verbatra-studio-sidebar";

export function readStoredSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function storeSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // The toggle still works for this page load; it just won't survive a reload.
  }
}
