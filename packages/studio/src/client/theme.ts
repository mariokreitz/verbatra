export type ThemePreference = "system" | "light" | "dark";

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "verbatra-studio-theme";

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

function isThemePreference(value: string): value is ThemePreference {
  return (PREFERENCES as readonly string[]).includes(value);
}

export function parseThemePreference(stored: string | null): ThemePreference {
  if (stored !== null && isThemePreference(stored)) {
    return stored;
  }
  return "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersLight ? "light" : "dark";
  }
  return preference;
}

export interface ThemeOption {
  readonly value: ThemePreference;
  readonly label: string;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
