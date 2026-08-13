import { z } from "zod";
import { type SupportedFormat, supportedFormatSchema } from "./supported-format.js";
import { type TranslationEntry, translationEntrySchema } from "./translation-entry.js";

export const localeResourceSchema = z.object({
  locale: z.string().min(1),
  namespace: z.string(),
  format: supportedFormatSchema,
  entries: z.map(z.string(), translationEntrySchema),
});

export interface LocaleResource {
  readonly locale: string;
  readonly namespace: string;
  readonly format: SupportedFormat;
  readonly entries: ReadonlyMap<string, TranslationEntry>;
}
