import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { getTranslations } from "next-intl/server";
import { GithubIcon } from "@/components/landing/github-icon";
import { CONTRIBUTING_URL } from "@/components/landing/links";
import { i18n, type Locale } from "@/lib/i18n";

const LANGUAGE_ARIA_KEY = "Choose a language(language switcher)(aria-label)";

/**
 * Fumadocs UI translations with one override per locale: the language switcher's
 * aria-label must contain the button's visible text (the current locale's display
 * name) or the label-in-name accessibility rule fails on every page.
 */
export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    en: { [LANGUAGE_ARIA_KEY]: "English - choose a language" },
    de: { [LANGUAGE_ARIA_KEY]: "Deutsch - Sprache wechseln" },
    es: { [LANGUAGE_ARIA_KEY]: "Español - elegir idioma" },
    fr: { [LANGUAGE_ARIA_KEY]: "Français - choisir la langue" },
  });

const localeNames = [
  { locale: "en", name: "English" },
  { locale: "de", name: "Deutsch" },
  { locale: "es", name: "Español" },
  { locale: "fr", name: "Français" },
];

export function i18nConfig(locale: string) {
  return { ...i18nProvider(translations, locale), locales: localeNames };
}

function localized(locale: Locale, path: string): string {
  return locale === i18n.defaultLanguage ? path : `/${locale}${path}`;
}

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
      {
        type: "icon",
        label: "GitHub",
        text: "GitHub",
        icon: <GithubIcon />,
        url: "https://github.com/mariokreitz/verbatra",
        external: true,
      },
    ],
    themeSwitch: { enabled: false },
  };
}
