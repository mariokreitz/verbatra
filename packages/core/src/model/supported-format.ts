import { z } from "zod";

/**
 * The closed set of source formats a LocaleResource can originate from.
 * v1 is JSON only; non-JSON formats (XLIFF, YAML, ARB) are post-v1.
 */
export const SUPPORTED_FORMATS = ["i18next-json", "vue-i18n-json", "next-intl-json"] as const;

export const supportedFormatSchema = z.enum(SUPPORTED_FORMATS);

export type SupportedFormat = z.infer<typeof supportedFormatSchema>;
