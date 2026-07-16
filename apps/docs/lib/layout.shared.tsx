import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { getTranslations } from "next-intl/server";
import { CONTRIBUTING_URL } from "@/components/landing/links";
import { i18n, type Locale } from "@/lib/i18n";

/** Fumadocs UI translations; de/es/fr inherit the English strings, since Fumadocs ships no bundled preset for them. */
export const translations = i18n.translations().extend(uiTranslations());

const localeNames = [
  { locale: "en", name: "English" },
  { locale: "de", name: "Deutsch" },
  { locale: "es", name: "Español" },
  { locale: "fr", name: "Français" },
];

/** RootProvider i18n config for the active locale, including the language switcher's autonym display names. */
export function i18nConfig(locale: string) {
  return { ...i18nProvider(translations, locale), locales: localeNames };
}

/** Prefixes a path with the locale, except for the unprefixed default locale, so chrome links never jump a reader out of their locale. */
function localized(locale: Locale, path: string): string {
  return locale === i18n.defaultLanguage ? path : `/${locale}${path}`;
}

/**
 * Shared nav chrome for the home, legal, and docs layouts: the brand mark,
 * the Docs and Contributing links, the GitHub URL, and a disabled theme
 * switch (the theme is forced dark). The llms.txt links are deliberately not
 * here; they are appended to the docs page tree instead (see
 * lib/docs-page-tree.ts), because Fumadocs renders layout links above the
 * tree with no way to reorder them.
 */
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
    links: [
      { text: t("docs"), url: localized(locale, "/docs") },
      { text: t("contributing"), url: CONTRIBUTING_URL, external: true },
    ],
    githubUrl: "https://github.com/mariokreitz/verbatra",
    themeSwitch: { enabled: false },
  };
}
