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
    // The llms.txt pair is NOT here: Fumadocs' `links`/`menuItems` mechanism always renders above
    // the page tree with no way to reorder it, which put "For AI agents" ahead of the real docs
    // navigation. It is appended to the end of the page tree itself instead; see
    // lib/docs-page-tree.ts and its use in app/[lang]/docs/layout.tsx.
    links: [
      { text: t("docs"), url: localized(locale, "/docs") },
      { text: t("contributing"), url: CONTRIBUTING_URL, external: true },
    ],
    githubUrl: "https://github.com/mariokreitz/verbatra",
    // The theme is forced dark via RootProvider, so the theme-switch control is removed.
    themeSwitch: { enabled: false },
  };
}
