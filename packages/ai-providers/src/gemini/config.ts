import { z } from "zod";

/**
 * Provider-specific configuration for the Gemini provider. The API key is deliberately
 * not here: it is read only from the environment.
 */
export const geminiConfigSchema = z.object({
  model: z.string().min(1),
  maxOutputTokens: z.number().int().positive(),
});

export type GeminiConfig = z.infer<typeof geminiConfigSchema>;
