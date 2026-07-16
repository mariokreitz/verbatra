import { defineI18n } from "fumadocs-core/i18n";

/** The site's locale configuration: English unprefixed as the default, de/es/fr prefixed, English as fallback. */
export const i18n = defineI18n({
  defaultLanguage: "en",
  languages: ["en", "de", "es", "fr"],
  hideLocale: "default-locale",
  fallbackLanguage: "en",
});

/** One of the supported site locales. */
export type Locale = (typeof i18n.languages)[number];
