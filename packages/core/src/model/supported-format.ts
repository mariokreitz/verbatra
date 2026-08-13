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

export const supportedFormatSchema = z.enum(SUPPORTED_FORMATS);

export type SupportedFormat = z.infer<typeof supportedFormatSchema>;
