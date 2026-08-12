import { i18n, type Locale, localizedPath } from "./i18n";
import versionData from "./version.generated.json";

export const SITE_URL = "https://verbatra.kreitz-webdev.de";

export const PACKAGE_VERSION = versionData.version;

export const LEGAL_LAST_UPDATED = "2026-07-02";

/**
 * Next.js `alternates` (self-referential canonical plus the full hreflang set with x-default) for a
 * page that exists in every locale, given its locale-agnostic path (for example `/privacy`). The
 * default language is unprefixed and x-default points at it, matching the site's URL scheme. Relative
 * paths resolve against the root layout's `metadataBase`.
 */
export function localeAlternates(locale: Locale, path: string) {
  const languages: Record<string, string> = {};
  for (const lang of i18n.languages) {
    languages[lang] = localizedPath(lang, path);
  }
  languages["x-default"] = localizedPath(i18n.defaultLanguage, path);
  return { canonical: localizedPath(locale, path), languages };
}

/**
 * The site root's path for a locale: the default language is unprefixed, every
 * other language gets a bare `/{locale}` segment. Kept separate from
 * `localizedPath` because the root has no path segment to append, so the generic
 * `/{locale}{path}` concatenation would leave a trailing slash here.
 */
export function homePath(locale: Locale): string {
  return locale === i18n.defaultLanguage ? "/" : `/${locale}`;
}

/**
 * Next.js `alternates` for the site root: self-referential canonical plus the full
 * hreflang set with x-default, derived from `i18n.languages` so the locale list has
 * one source of truth instead of being re-enumerated at each call site.
 */
export function homeAlternates(locale: Locale) {
  const languages: Record<string, string> = {};
  for (const lang of i18n.languages) {
    languages[lang] = homePath(lang);
  }
  languages["x-default"] = homePath(i18n.defaultLanguage);
  return { canonical: homePath(locale), languages };
}

/**
 * Open Graph locale in the `language_TERRITORY` form the OG spec expects (for example `en_US`),
 * rather than the bare language tag. Maps each supported UI locale to a representative territory.
 */
const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  de: "de_DE",
  es: "es_ES",
  fr: "fr_FR",
};

export function ogLocale(locale: Locale): string {
  return OG_LOCALES[locale];
}

/** The `og:locale:alternate` set: every supported locale except the current one, territory-qualified. */
export function ogAlternateLocales(locale: Locale): string[] {
  return i18n.languages.filter((lang) => lang !== locale).map((lang) => OG_LOCALES[lang]);
}
