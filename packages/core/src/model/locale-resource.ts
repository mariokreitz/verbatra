import { z } from "zod";
import { type SupportedFormat, supportedFormatSchema } from "./supported-format.js";
import { type TranslationEntry, translationEntrySchema } from "./translation-entry.js";

/**
 * All entries for one locale and namespace, addressable by key, tagged with the
 * format they came from for round-trip fidelity.
 */
export const localeResourceSchema = z.object({
  locale: z.string().min(1),
  namespace: z.string(),
  format: supportedFormatSchema,
  entries: z.map(z.string(), translationEntrySchema),
});

/** All translation entries for one locale and namespace, keyed by entry key. */
export interface LocaleResource {
  /** The locale these entries belong to (for example, "en" or "de"). */
  readonly locale: string;
  /** The namespace these entries belong to. */
  readonly namespace: string;
  /** The source format the resource came from, for round-trip fidelity. */
  readonly format: SupportedFormat;
  /** Entries addressable by key. */
  readonly entries: ReadonlyMap<string, TranslationEntry>;
}
