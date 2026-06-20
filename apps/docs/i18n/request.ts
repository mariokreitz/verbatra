import { getRequestConfig } from "next-intl/server";
import { i18n, type Locale } from "@/lib/i18n";

// next-intl runs here as a message-catalog provider only; Fumadocs owns routing and the
// active locale (the `[lang]` segment). We still validate the requested locale against our
// own set and fall back to the default so a stray value can never load a missing catalog.
function resolveLocale(requested: string | undefined): Locale {
  if (requested && (i18n.languages as readonly string[]).includes(requested)) {
    return requested as Locale;
  }
  return i18n.defaultLanguage;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale);
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
