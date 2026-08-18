import type { Locale } from "@/lib/i18n";

export const LOCALE_DISPLAY_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
};

export const LOCALE_SWITCHER_ARIA_LABELS: Record<Locale, string> = {
  en: "English - choose a language",
  de: "Deutsch - Sprache wechseln",
  es: "Español - elegir idioma",
  fr: "Français - choisir la langue",
};
