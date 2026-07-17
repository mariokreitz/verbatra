import { z } from "zod";

/**
 * Provider-specific configuration for the OpenAI provider. The API key is not here;
 * it is read only from the environment.
 */
export const openAiConfigSchema = z.object({
  model: z.string().min(1),
  maxOutputTokens: z.number().int().positive(),
});

/** The validated OpenAI provider configuration, inferred from {@link openAiConfigSchema}. */
export type OpenAiConfig = z.infer<typeof openAiConfigSchema>;
