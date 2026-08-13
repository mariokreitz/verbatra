import {
  parseThemePreference,
  type ResolvedTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../../client/theme.js";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

export function readStoredThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {}
}

function systemPrefersLight(): boolean {
  return window.matchMedia(LIGHT_QUERY).matches;
}

let appliedPreference: ThemePreference | null = null;

function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}

export function applyThemePreference(preference: ThemePreference): void {
  appliedPreference = preference;
  applyResolvedTheme(resolveTheme(preference, systemPrefersLight()));
}

function handleOsSchemeChange(): void {
  if (appliedPreference === "system") {
    applyThemePreference("system");
  }
}

let trackedQuery: MediaQueryList | null = null;

export function initTheme(): void {
  applyThemePreference(readStoredThemePreference());
  trackedQuery?.removeEventListener("change", handleOsSchemeChange);
  trackedQuery = window.matchMedia(LIGHT_QUERY);
  trackedQuery.addEventListener("change", handleOsSchemeChange);
}
