/**
 * The browser half of the theme switcher: localStorage, matchMedia, and the
 * root data-theme attribute. Parsing and resolution live in
 * `client/theme.ts`; this module executes those decisions against real
 * browser APIs.
 */
import {
  parseThemePreference,
  type ResolvedTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../../client/theme.js";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** The stored preference, or "system" when nothing valid is stored or storage throws. */
export function readStoredThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Persists a preference; swallows storage errors, so the choice may not survive a reload. */
export function storeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {}
}

function systemPrefersLight(): boolean {
  return window.matchMedia(LIGHT_QUERY).matches;
}

/**
 * The last preference this module applied, so the OS-change listener honors
 * an explicit in-session choice even when persisting it failed; re-reading
 * only storage there would fall back to "system" and override the user's
 * pick.
 */
let appliedPreference: ThemePreference | null = null;

/** Writes the resolved theme onto the root element's data-theme attribute. */
function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}

/** Resolves a preference against the current OS scheme and applies it to the document root. */
export function applyThemePreference(preference: ThemePreference): void {
  appliedPreference = preference;
  applyResolvedTheme(resolveTheme(preference, systemPrefersLight()));
}

/** Re-resolves the theme on an OS scheme flip, but only while the preference is "system". */
function handleOsSchemeChange(): void {
  if (appliedPreference === "system") {
    applyThemePreference("system");
  }
}

/**
 * The media query this module last attached its listener to. `matchMedia`
 * hands back a fresh object per call, and a listener can only be removed
 * through the object it was added to, so the object itself is what has to be
 * retained rather than a plain "already attached" flag.
 */
let trackedQuery: MediaQueryList | null = null;

/**
 * Applies the stored preference once at startup and keeps a "system"
 * preference tracking live OS changes for the lifetime of the page. The
 * listener consults the in-memory applied preference, not storage, so an
 * explicit in-session choice is never overridden by a later OS flip.
 *
 * The function is idempotent: it detaches the listener a previous call left
 * behind before attaching a new one, so however often it runs, at most one
 * change listener stays active. It therefore returns no teardown handle.
 */
export function initTheme(): void {
  applyThemePreference(readStoredThemePreference());
  trackedQuery?.removeEventListener("change", handleOsSchemeChange);
  trackedQuery = window.matchMedia(LIGHT_QUERY);
  trackedQuery.addEventListener("change", handleOsSchemeChange);
}
