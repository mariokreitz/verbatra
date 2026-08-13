// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStoredSidebarCollapsed, storeSidebarCollapsed } from "./sidebar-dom.js";

const STORAGE_KEY = "verbatra-studio-sidebar";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function breakStorage(): void {
  const denied = (): never => {
    throw new Error("storage is not available");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
}

describe("readStoredSidebarCollapsed", () => {
  it("reports collapsed when that is what was stored", () => {
    window.localStorage.setItem(STORAGE_KEY, "collapsed");

    expect(readStoredSidebarCollapsed()).toBe(true);
  });

  it("reports expanded for the stored expanded marker", () => {
    window.localStorage.setItem(STORAGE_KEY, "expanded");

    expect(readStoredSidebarCollapsed()).toBe(false);
  });

  it("defaults to expanded on a first visit, when nothing is stored yet", () => {
    expect(readStoredSidebarCollapsed()).toBe(false);
  });

  it("defaults to expanded for an unrecognized stored value rather than trusting it", () => {
    window.localStorage.setItem(STORAGE_KEY, "COLLAPSED");

    expect(readStoredSidebarCollapsed()).toBe(false);
  });

  it("falls back to expanded when reading storage throws, so the shell still renders", () => {
    breakStorage();

    expect(readStoredSidebarCollapsed()).toBe(false);
  });
});

describe("storeSidebarCollapsed", () => {
  it("persists the collapsed state under the sidebar key", () => {
    storeSidebarCollapsed(true);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("collapsed");
  });

  it("persists the expanded state, so collapsing and reopening is not a no-op write", () => {
    window.localStorage.setItem(STORAGE_KEY, "collapsed");

    storeSidebarCollapsed(false);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("expanded");
  });

  it("swallows a storage failure instead of propagating it to the toggling component", () => {
    breakStorage();

    expect(() => storeSidebarCollapsed(true)).not.toThrow();
  });
});
