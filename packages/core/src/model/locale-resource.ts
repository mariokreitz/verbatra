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

/**
 * Validate an unknown value into a {@link LocaleResource}.
 *
 * @param input - The value to validate, typically parsed JSON of unknown shape.
 * @returns The validated resource.
 * @throws If `input` does not satisfy {@link localeResourceSchema}; zod raises a `ZodError`
 *   describing the failing fields.
 * @example
 * ```ts
 * const resource = parseLocaleResource({
 *   locale: "de",
 *   namespace: "common",
 *   format: "i18next-json",
 *   entries: new Map([["greeting", entry]]),
 * });
 * ```
 */
export function parseLocaleResource(input: unknown): LocaleResource {
  return localeResourceSchema.parse(input);
}
