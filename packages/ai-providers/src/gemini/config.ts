import { z } from "zod";

/**
 * Provider-specific configuration for the Gemini provider. The model is required
 * and never hardcoded in provider logic; the output-token limit is required and set
 * on every request (as config.maxOutputTokens). The API key is deliberately NOT
 * here: it is read only from the environment.
 */
export const geminiConfigSchema = z.object({
  model: z.string().min(1),
  maxOutputTokens: z.number().int().positive(),
});

export type GeminiConfig = z.infer<typeof geminiConfigSchema>;
