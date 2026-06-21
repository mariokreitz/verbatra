import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { getTranslations } from "next-intl/server";
import { i18n, type Locale } from "@/lib/i18n";

// The translation registry handed to Fumadocs UI. We only carry verbatra's own locales; the
// built-in `uiTranslations()` ships Fumadocs's English UI strings, which de/es/fr inherit
// (Fumadocs has no bundled de/es/fr UI preset and the chrome copy is minimal). When localized
// Fumadocs UI strings are needed later, add `.preset(locale, …)` here.
export const translations = i18n.translations().extend(uiTranslations());

// Display names for the language switcher, in autonyms. These populate Fumadocs's built-in
// switcher (`locales` on the i18n provider props); without them it only knows the current
// locale and shows "English" alone.
const localeNames = [
  { locale: "en", name: "English" },
  { locale: "de", name: "Deutsch" },
  { locale: "es", name: "Español" },
  { locale: "fr", name: "Français" },
];

/** RootProvider i18n config for the active locale. Fumadocs renders the only language switcher
 *  in the chrome (home + docs); `locales` gives it the display names so it lists all four. */
export function i18nConfig(locale: string) {
  return { ...i18nProvider(translations, locale), locales: localeNames };
}

// `default-locale` routing: English is unprefixed, the others are prefixed. Internal links in
// the chrome follow the same rule so the nav never jumps a reader out of their locale.
function localized(locale: Locale, path: string): string {
  return locale === i18n.defaultLanguage ? path : `/${locale}${path}`;
}

// Shared chrome for the home, legal, and docs layouts: the V mark + verbatra wordmark, the
// locale-prefixed Docs link, and the repository link. Strings come from the next-intl catalog
// so nothing in the chrome is hardcoded English. The language switcher is Fumadocs's built-in
// control (configured via `i18nConfig` above), so the nav itself stays fully server-rendered.
export async function baseOptions(locale: Locale): Promise<BaseLayoutProps> {
  const t = await getTranslations({ locale, namespace: "landing.nav" });
  return {
    nav: {
      url: localized(locale, "/"),
      title: (
        <span className="inline-flex items-center gap-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{
              filter: "drop-shadow(0 0 4px color-mix(in srgb, var(--v-glow) 60%, transparent))",
            }}
          >
            <path
              d="M4 4 L12 20 L20 4"
              stroke="var(--v-glow)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="text-base font-semibold tracking-widest"
            style={{ fontFamily: "var(--font-display)" }}
          >
            VERBATRA
          </span>
        </span>
      ),
    },
    links: [{ text: t("docs"), url: localized(locale, "/docs") }],
    githubUrl: "https://github.com/mariokreitz/verbatra",
    // Dark-only app-wide: remove the Fumadocs theme-switch control from the nav chrome (the
    // theme is forced dark via RootProvider `theme={{ enabled: false }}`).
    themeSwitch: { enabled: false },
  };
}
