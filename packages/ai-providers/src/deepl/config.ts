import { z } from "zod";

/**
 * Provider-specific configuration for the DeepL provider. The optional glossaryId is
 * a pre-existing DeepL glossary ID passed natively to translateText (v1 is glossary-ID
 * pass-through only). The API key is deliberately NOT here: it is read only from the
 * environment.
 */
export const deepLConfigSchema = z.object({
  glossaryId: z.string().min(1).optional(),
});

export type DeepLConfig = z.infer<typeof deepLConfigSchema>;
