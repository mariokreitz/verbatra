import type { ReactNode } from "react";
import { useState } from "react";
import { THEME_OPTIONS, type ThemePreference } from "../client/theme.js";
import { Dropdown } from "./Dropdown.js";
import { Icon, type IconName } from "./Icon.js";
import {
  applyThemePreference,
  readStoredThemePreference,
  storeThemePreference,
} from "./lib/theme-dom.js";

const PREFERENCE_ICON: Readonly<Record<ThemePreference, IconName>> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
};

/**
 * The System/Light/Dark theme picker, an icon-triggered `Dropdown` in the top bar. Selecting a
 * preference persists it (localStorage), applies it to the root immediately (see
 * `lib/theme-dom.ts`), and keeps this component's own state in sync so the trigger icon and the
 * checked item track the choice. A "system" choice keeps following live OS changes through the
 * matchMedia listener `initTheme` registered at startup; nothing here needs to re-listen.
 */
export function ThemeSwitcher(): ReactNode {
  const [preference, setPreference] = useState<ThemePreference>(readStoredThemePreference);

  function handleSelect(next: ThemePreference): void {
    setPreference(next);
    storeThemePreference(next);
    applyThemePreference(next);
  }

  const activeLabel = THEME_OPTIONS.find((option) => option.value === preference)?.label ?? "";

  return (
    <Dropdown
      variant="ghost"
      align="end"
      ariaLabel={`Theme: ${activeLabel}`}
      label={<Icon name={PREFERENCE_ICON[preference]} />}
      items={THEME_OPTIONS.map((option) => ({
        label: option.label,
        selected: option.value === preference,
        onSelect: () => handleSelect(option.value),
      }))}
    />
  );
}
