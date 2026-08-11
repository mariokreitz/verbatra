// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "../../client/theme.js";
import {
  applyThemePreference,
  initTheme,
  readStoredThemePreference,
  storeThemePreference,
} from "./theme-dom.js";

/** The stub standing in for `window.matchMedia`, which jsdom does not implement. */
interface MediaStub {
  /** Flips what the OS reports, for the next read and for a subsequent change event. */
  setPrefersLight(next: boolean): void;
  /** Plays one OS scheme change into every registered listener. */
  emitChange(): void;
  /** How many change listeners are live across every query the stub handed out. */
  listenerCount(): number;
}

function installMatchMedia(prefersLight: boolean): MediaStub {
  let matches = prefersLight;
  // A real `matchMedia` returns a new MediaQueryList per call and each one owns its listener
  // list, so the stub does the same. One shared object would count a listener re-registered on
  // the same query and one leaked onto a second query alike, and hide the leak.
  const queries: Array<Set<() => void>> = [];
  // `systemPrefersLight` calls `window.matchMedia` afresh on every read, so each query exposes
  // `matches` as a getter over the shared flag rather than a snapshot of it.
  const createQuery = (): MediaQueryList => {
    const listeners = new Set<() => void>();
    queries.push(listeners);
    return {
      get matches(): boolean {
        return matches;
      },
      addEventListener(_type: string, listener: () => void): void {
        listeners.add(listener);
      },
      removeEventListener(_type: string, listener: () => void): void {
        listeners.delete(listener);
      },
    } as unknown as MediaQueryList;
  };
  vi.stubGlobal("matchMedia", createQuery);
  return {
    setPrefersLight(next: boolean): void {
      matches = next;
    },
    emitChange(): void {
      for (const listeners of queries) {
        for (const listener of [...listeners]) {
          listener();
        }
      }
    },
    listenerCount: (): number => queries.reduce((total, listeners) => total + listeners.size, 0),
  };
}

/** Makes every read and write on the real storage throw, the way a blocked or full store does. */
function breakStorage(): void {
  const denied = (): never => {
    throw new Error("storage is not available");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
}

function appliedTheme(): string | undefined {
  return document.documentElement.dataset.theme;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("readStoredThemePreference", () => {
  it("returns the stored preference when one was persisted", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    expect(readStoredThemePreference()).toBe("dark");
  });

  it("falls back to system when nothing is stored yet", () => {
    expect(readStoredThemePreference()).toBe("system");
  });

  it("falls back to system for a value this build does not recognize", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");

    expect(readStoredThemePreference()).toBe("system");
  });

  it("falls back to system when reading storage throws", () => {
    breakStorage();

    expect(readStoredThemePreference()).toBe("system");
  });
});

describe("storeThemePreference", () => {
  it("persists the preference under the shared theme key", () => {
    storeThemePreference("light");

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("swallows a storage failure instead of propagating it to the switcher", () => {
    breakStorage();

    expect(() => storeThemePreference("dark")).not.toThrow();
  });
});

describe("applyThemePreference", () => {
  it("writes an explicit light preference onto the root element", () => {
    installMatchMedia(false);

    applyThemePreference("light");

    expect(appliedTheme()).toBe("light");
  });

  it("writes an explicit dark preference onto the root element, ignoring the OS scheme", () => {
    installMatchMedia(true);

    applyThemePreference("dark");

    expect(appliedTheme()).toBe("dark");
  });

  it("resolves a system preference to light when the OS asks for light", () => {
    installMatchMedia(true);

    applyThemePreference("system");

    expect(appliedTheme()).toBe("light");
  });

  it("resolves a system preference to dark when the OS does not ask for light", () => {
    installMatchMedia(false);

    applyThemePreference("system");

    expect(appliedTheme()).toBe("dark");
  });
});

describe("initTheme", () => {
  it("applies the stored preference at startup", () => {
    installMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    initTheme();

    expect(appliedTheme()).toBe("dark");
  });

  it("applies the OS-resolved theme at startup when no preference is stored", () => {
    installMatchMedia(false);

    initTheme();

    expect(appliedTheme()).toBe("dark");
  });

  it("registers exactly one listener for live OS scheme changes", () => {
    const media = installMatchMedia(false);

    initTheme();

    expect(media.listenerCount()).toBe(1);
  });

  it("does not accumulate listeners when it runs more than once", () => {
    const media = installMatchMedia(false);

    initTheme();
    initTheme();
    initTheme();

    expect(media.listenerCount()).toBe(1);
  });

  it("still tracks the OS scheme through the surviving listener after a repeat call", () => {
    const media = installMatchMedia(false);
    initTheme();
    initTheme();

    media.setPrefersLight(true);
    media.emitChange();

    expect(appliedTheme()).toBe("light");
  });

  it("re-resolves a system preference when the OS scheme flips", () => {
    const media = installMatchMedia(false);
    initTheme();

    media.setPrefersLight(true);
    media.emitChange();

    expect(appliedTheme()).toBe("light");
  });

  it("keeps an explicit in-session choice when the OS flips, even though storage never took it", () => {
    // Storage is unusable, so a listener that re-read storage would see "system" and resolve the
    // OS scheme, silently discarding the light theme the user picked in this session.
    breakStorage();
    const media = installMatchMedia(false);
    initTheme();
    expect(appliedTheme()).toBe("dark");

    applyThemePreference("light");
    media.emitChange();

    expect(appliedTheme()).toBe("light");
  });

  it("resumes tracking the OS once the user returns to the system preference", () => {
    const media = installMatchMedia(true);
    initTheme();
    applyThemePreference("dark");
    applyThemePreference("system");

    media.setPrefersLight(false);
    media.emitChange();

    expect(appliedTheme()).toBe("dark");
  });
});
