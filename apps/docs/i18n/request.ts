import { getRequestConfig } from "next-intl/server";
import { i18n, type Locale } from "@/lib/i18n";
import en from "../messages/en.json";

type Messages = Record<string, unknown>;

/** Validates the requested locale, falling back to the default so a stray value can never load a missing catalog. */
function resolveLocale(requested: string | undefined): Locale {
  if (requested && (i18n.languages as readonly string[]).includes(requested)) {
    return requested as Locale;
  }
  return i18n.defaultLanguage;
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges a locale catalog over the English base, locale values winning.
 * next-intl does not fall back per message, so a key present only in en.json
 * would otherwise render its raw path under de/es/fr until `pnpm i18n`
 * regenerates the catalogs.
 */
function withFallback(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      isPlainObject(current) && isPlainObject(value) ? withFallback(current, value) : value;
  }
  return merged;
}

/** next-intl request config: resolves the locale and loads its messages with English fallback merged in. */
export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale);
  const base = en as Messages;
  if (locale === i18n.defaultLanguage) {
    return { locale, messages: base };
  }
  const localeMessages = (await import(`../messages/${locale}.json`)).default as Messages;
  return { locale, messages: withFallback(base, localeMessages) };
});
