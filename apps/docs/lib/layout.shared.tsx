import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { getTranslations } from "next-intl/server";
import { VMark } from "@/components/landing";
import { GithubIcon } from "@/components/landing/github-icon";
import { CONTRIBUTING_URL } from "@/components/landing/links";
import { i18n, type Locale, localizedPath } from "@/lib/i18n";

const LANGUAGE_ARIA_KEY = "Choose a language(language switcher)(aria-label)";

export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    en: { [LANGUAGE_ARIA_KEY]: "English - choose a language" },
    de: { [LANGUAGE_ARIA_KEY]: "Deutsch - Sprache wechseln" },
    es: { [LANGUAGE_ARIA_KEY]: "Español - elegir idioma" },
    fr: { [LANGUAGE_ARIA_KEY]: "Français - choisir la langue" },
  });

const LOCALE_DISPLAY_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
};

const localeNames = i18n.languages.map((locale) => ({
  locale,
  name: LOCALE_DISPLAY_NAMES[locale],
}));

export function i18nConfig(locale: string) {
  return { ...i18nProvider(translations, locale), locales: localeNames };
}

export async function baseOptions(locale: Locale): Promise<BaseLayoutProps> {
  const t = await getTranslations({ locale, namespace: "landing.nav" });
  return {
    nav: {
      url: localizedPath(locale, "/"),
      title: (
        <span className="inline-flex items-center gap-2">
          <VMark size={20} blur={4} decorative />
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
      { text: t("docs"), url: localizedPath(locale, "/docs") },
      { text: t("contributing"), url: CONTRIBUTING_URL, external: true },
      {
        type: "icon",
        label: "GitHub",
        text: "GitHub",
        icon: <GithubIcon />,
        url: "https://github.com/verbatra/verbatra",
        external: true,
      },
    ],
    themeSwitch: { enabled: false },
  };
}
