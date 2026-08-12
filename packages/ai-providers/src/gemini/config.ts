import { z } from "zod";
import { requestTimeoutConfigSchema } from "../request-timeout-config.js";

/**
 * Provider-specific configuration for the Gemini provider, plus the shared requestTimeoutMs field.
 * The API key is deliberately not here: it is read only from the environment.
 */
export const geminiConfigSchema = z
  .object({
    model: z.string().min(1),
    maxOutputTokens: z.number().int().positive(),
  })
  .extend(requestTimeoutConfigSchema.shape);

/** The validated Gemini provider configuration, inferred from {@link geminiConfigSchema}. */
export type GeminiConfig = z.infer<typeof geminiConfigSchema>;
