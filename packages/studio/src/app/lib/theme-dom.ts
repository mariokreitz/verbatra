/**
 * The browser half of the theme switcher: localStorage, matchMedia, and the root data-theme
 * attribute. Every decision (parsing, resolution, the option list) lives in the covered
 * `client/theme.ts`; this module only executes those decisions against real browser APIs, which
 * is why it lives in the untested app layer.
 */
import {
  parseThemePreference,
  type ResolvedTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../../client/theme.js";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** The stored preference, or "system" when nothing (or garbage) is stored, or storage throws
 * (Safari private windows historically did; a theme preference is never worth an error). */
export function readStoredThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Persists a preference; swallows storage errors for the same reason reads do. */
export function storeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The switcher still applies the theme for this page load; it just won't survive a reload.
  }
}

function systemPrefersLight(): boolean {
  return window.matchMedia(LIGHT_QUERY).matches;
}

/**
 * The last preference this module applied, so the OS-change listener can honor an explicit
 * in-session choice even when persisting it failed (a full quota, a storage-less context):
 * re-reading only storage there would silently fall back to "system" and override the user's
 * explicit pick. Module-level state is safe here: the module is a singleton per page, exactly
 * like the theme it mirrors.
 */
let appliedPreference: ThemePreference | null = null;

/** Writes the resolved theme onto the root element; styles.css keys every token off this. */
function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}

/** Resolves and applies a preference in one step: what the switcher and startup both do. */
export function applyThemePreference(preference: ThemePreference): void {
  appliedPreference = preference;
  applyResolvedTheme(resolveTheme(preference, systemPrefersLight()));
}

/**
 * Applies the stored preference (called once in main.tsx before the first render, so the first
 * painted frame already has the right theme) and keeps a "system" preference tracking live OS
 * changes for the lifetime of the page. The listener consults the in-memory applied preference,
 * not storage: an explicit light/dark choice made after startup must never be overridden by a
 * later OS flip, including when persisting that choice failed.
 */
export function initTheme(): void {
  applyThemePreference(readStoredThemePreference());
  window.matchMedia(LIGHT_QUERY).addEventListener("change", () => {
    if (appliedPreference === "system") {
      applyThemePreference("system");
    }
  });
}
