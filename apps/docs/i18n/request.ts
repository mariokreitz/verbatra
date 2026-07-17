import { getRequestConfig } from "next-intl/server";
import { i18n, type Locale } from "@/lib/i18n";
import en from "../messages/en.json";

type Messages = Record<string, unknown>;

function resolveLocale(requested: string | undefined): Locale {
  if (requested && (i18n.languages as readonly string[]).includes(requested)) {
    return requested as Locale;
  }
  return i18n.defaultLanguage;
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withFallback(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      isPlainObject(current) && isPlainObject(value) ? withFallback(current, value) : value;
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale);
  const base = en as Messages;
  if (locale === i18n.defaultLanguage) {
    return { locale, messages: base };
  }
  const localeMessages = (await import(`../messages/${locale}.json`)).default as Messages;
  return { locale, messages: withFallback(base, localeMessages) };
});
