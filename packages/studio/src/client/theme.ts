/**
 * Theme preference logic for the dashboard's light/dark switcher: parsing a stored preference,
 * resolving "system" against the OS setting, and the option list the switcher renders. Pure and
 * DOM-free; the browser glue (localStorage, matchMedia, the data-theme attribute write) lives in
 * `app/lib/theme-dom.ts`, keeping everything decision-shaped here under the coverage gate.
 */

/** What the user chose: an explicit theme, or following the OS preference. */
export type ThemePreference = "system" | "light" | "dark";

/** What actually renders. "system" always resolves to one of these before touching the DOM. */
export type ResolvedTheme = "light" | "dark";

/** The localStorage key the preference persists under across page loads. */
export const THEME_STORAGE_KEY = "verbatra-studio-theme";

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

function isThemePreference(value: string): value is ThemePreference {
  return (PREFERENCES as readonly string[]).includes(value);
}

/**
 * Parses a raw stored value into a preference. Anything unrecognized (no stored value yet, or a
 * value from an older or newer version of this dashboard) falls back to "system" rather than
 * erroring: the stored preference is a convenience, never a contract.
 */
export function parseThemePreference(stored: string | null): ThemePreference {
  if (stored !== null && isThemePreference(stored)) {
    return stored;
  }
  return "system";
}

/** Resolves a preference to the theme that should render, given the OS preference. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersLight ? "light" : "dark";
  }
  return preference;
}

/** One switcher entry: the storable preference value and its visible label. */
export interface ThemeOption {
  readonly value: ThemePreference;
  readonly label: string;
}

/** The switcher's option list, in display order. Covers every {@link ThemePreference}. */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
