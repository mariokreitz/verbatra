import { defineI18n } from "fumadocs-core/i18n";
import { notFound } from "next/navigation";

export const i18n = defineI18n({
  defaultLanguage: "en",
  languages: ["en", "de", "es", "fr"],
  hideLocale: "default-locale",
  fallbackLanguage: "en",
});

export type Locale = (typeof i18n.languages)[number];

/** Narrows a string to a Locale, matching the configured `i18n.languages` set. */
export function isLocale(value: string): value is Locale {
  return (i18n.languages as readonly string[]).includes(value);
}

/**
 * Validates a route's `params.lang` against `i18n.languages`. Every nested route
 * under `[lang]` renders behind the root layout's own guard, which already calls
 * `notFound()` for anything outside the configured locales, so this mirrors that
 * same fallback rather than inventing a second one for the routes underneath it.
 */
export function toLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}

/**
 * Prefix an internal absolute path with the active locale, matching the Fumadocs loader's URL scheme:
 * the default language has no prefix, every other language gets a `/{locale}` prefix. Reuse this
 * wherever an internal link is built so a localized page never links back into the English tree.
 */
export function localizedPath(locale: Locale, path: string): string {
  return locale === i18n.defaultLanguage ? path : `/${locale}${path}`;
}

/**
 * Locale-prefix an href only when it is an internal absolute path. External URLs, protocol-relative
 * URLs, in-page anchors, and mailto/tel links are returned unchanged, as are paths already carrying
 * the active locale prefix. Undefined passes through so callers can forward an optional href.
 */
export function localizeHref(locale: Locale, href: string | undefined): string | undefined {
  if (href === undefined || !href.startsWith("/") || href.startsWith("//")) {
    return href;
  }
  if (href === `/${locale}` || href.startsWith(`/${locale}/`)) {
    return href;
  }
  return localizedPath(locale, href);
}
