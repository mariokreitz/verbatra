import { z } from "zod";

export const SUPPORTED_FORMATS = [
  "i18next-json",
  "vue-i18n-json",
  "next-intl-json",
  "ngx-translate-json",
  "xliff",
  "yaml",
  "arb",
  "properties",
] as const;

/**
 * Zod schema accepting exactly one of the eight source formats verbatra can read and write. Each
 * member names the ecosystem it round-trips, not just a file extension, because several of them share
 * one: `i18next-json` is i18next's nested JSON with its plural key suffixes, `vue-i18n-json` is Vue
 * I18n's JSON with its pipe-separated plural values, `next-intl-json` is next-intl's ICU-message JSON,
 * and `ngx-translate-json` is ngx-translate's nested JSON. The remaining four are `xliff` (the XLIFF
 * interchange XML), `yaml` (plain nested YAML), `arb` (Flutter's Application Resource Bundle), and
 * `properties` (Java and Spring `.properties` files).
 *
 * The set is closed: a format outside it cannot be represented, so adding one means adding a member
 * here and an adapter that claims it.
 */
export const supportedFormatSchema = z.enum(SUPPORTED_FORMATS);

/** One of the eight supported source formats; the inferred type of {@link supportedFormatSchema}. */
export type SupportedFormat = z.infer<typeof supportedFormatSchema>;
