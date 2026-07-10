import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { getTranslations } from "next-intl/server";
import { CONTRIBUTING_URL } from "@/components/landing/links";
import { i18n, type Locale } from "@/lib/i18n";

// de/es/fr inherit Fumadocs's English UI strings, since it ships no bundled preset for them.
export const translations = i18n.translations().extend(uiTranslations());

// Autonyms for the language switcher; without them Fumadocs lists only the current locale.
const localeNames = [
  { locale: "en", name: "English" },
  { locale: "de", name: "Deutsch" },
  { locale: "es", name: "Español" },
  { locale: "fr", name: "Français" },
];

/** RootProvider i18n config for the active locale, including switcher display names. */
export function i18nConfig(locale: string) {
  return { ...i18nProvider(translations, locale), locales: localeNames };
}

// English is unprefixed and other locales are prefixed; chrome links follow the same rule so the nav never jumps a reader out of their locale.
function localized(locale: Locale, path: string): string {
  return locale === i18n.defaultLanguage ? path : `/${locale}${path}`;
}

// Shared nav chrome for the home, legal, and docs layouts, with strings from the next-intl catalog.
export async function baseOptions(locale: Locale): Promise<BaseLayoutProps> {
  const t = await getTranslations({ locale, namespace: "landing.nav" });
  const tLlms = await getTranslations({ locale, namespace: "docs.llms" });
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
    // A minimal, real link set. Docs points into the sidebar tree; Contributing is an external
    // link to the repo's CONTRIBUTING.md, surfaced in the header the way Node.js does. Providers
    // and Formats are intentionally omitted: they already sit in the docs sidebar tree, so listing
    // them here duplicated them in the docs rail. The GitHub icon and search trigger sit in the
    // right-side actions.
    //
    // The llms.txt pair is `on: "menu"` only, so it renders inside the docs sidebar's scrollable
    // link list (above the page tree, via Fumadocs' own menuItems mechanism) and never the top
    // nav bar. An earlier attempt pinned these into DocsLayout's `sidebar.footer` slot instead,
    // which sits in a fixed-height chrome region below the page tree's scroll area and squeezed
    // it; menuItems live inside the same scrollable viewport as the page tree, so they cannot.
    links: [
      { text: t("docs"), url: localized(locale, "/docs") },
      { text: t("contributing"), url: CONTRIBUTING_URL, external: true },
      {
        type: "custom",
        on: "menu",
        children: <p className="px-2 pt-4 first:pt-0">{tLlms("heading")}</p>,
      },
      { text: tLlms("index"), url: "/llms.txt", on: "menu" },
      { text: tLlms("full"), url: "/llms-full.txt", on: "menu" },
    ],
    githubUrl: "https://github.com/mariokreitz/verbatra",
    // The theme is forced dark via RootProvider, so the theme-switch control is removed.
    themeSwitch: { enabled: false },
  };
}
