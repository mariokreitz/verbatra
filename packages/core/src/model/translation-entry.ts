import { z } from "zod";

/**
 * A single, format-neutral translation unit. Placeholders are supplied already
 * extracted; core never derives them from the value.
 */
export const translationEntrySchema = z.object({
  key: z.string().min(1),
  namespace: z.string(),
  value: z.string(),
  description: z.string().optional(),
  meaning: z.string().optional(),
  placeholders: z.array(z.string()).readonly(),
  isPlural: z.boolean(),
});

/** The validated shape of one translation unit; the inferred type of {@link translationEntrySchema}. */
export type TranslationEntry = Readonly<z.infer<typeof translationEntrySchema>>;

/**
 * Validate an unknown value into a {@link TranslationEntry}.
 *
 * @param input - The value to validate, typically parsed JSON of unknown shape.
 * @returns The validated, immutable entry.
 * @throws If `input` does not satisfy {@link translationEntrySchema}; zod raises a `ZodError`
 *   describing the failing fields.
 * @example
 * ```ts
 * const entry = parseTranslationEntry({
 *   key: "greeting",
 *   namespace: "common",
 *   value: "Hi {name}",
 *   placeholders: ["{name}"],
 *   isPlural: false,
 * });
 * ```
 */
export function parseTranslationEntry(input: unknown): TranslationEntry {
  return translationEntrySchema.parse(input);
}
