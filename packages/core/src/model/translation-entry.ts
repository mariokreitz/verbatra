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
