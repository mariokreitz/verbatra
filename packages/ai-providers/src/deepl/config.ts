import { z } from "zod";

/**
 * DeepL provider configuration. `glossaryId` is an existing DeepL glossary ID passed
 * natively to translateText. The API key is intentionally absent: it is read only from
 * the environment.
 */
export const deepLConfigSchema = z.object({
  glossaryId: z.string().min(1).optional(),
});

export type DeepLConfig = z.infer<typeof deepLConfigSchema>;
