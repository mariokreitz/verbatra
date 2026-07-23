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
