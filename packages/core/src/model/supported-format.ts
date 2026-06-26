import { z } from "zod";

/**
 * The closed set of source formats a LocaleResource can originate from.
 * The first four are the JSON i18n family; XLIFF, YAML, and ARB are the
 * shipped non-JSON formats that join them.
 */
export const SUPPORTED_FORMATS = [
  "i18next-json",
  "vue-i18n-json",
  "next-intl-json",
  "ngx-translate-json",
  "xliff",
  "yaml",
  "arb",
] as const;

/** Zod schema accepting exactly one of {@link SUPPORTED_FORMATS}. */
export const supportedFormatSchema = z.enum(SUPPORTED_FORMATS);

/** One of the supported source formats; a member of {@link SUPPORTED_FORMATS}. */
export type SupportedFormat = z.infer<typeof supportedFormatSchema>;
