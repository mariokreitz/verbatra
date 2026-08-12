import { z } from "zod";
import { requestTimeoutConfigSchema } from "../request-timeout-config.js";

/**
 * Provider-specific configuration for the OpenAI provider, plus the shared requestTimeoutMs field.
 * The API key is not here; it is read only from the environment.
 */
export const openAiConfigSchema = z
  .object({
    model: z.string().min(1),
    maxOutputTokens: z.number().int().positive(),
  })
  .extend(requestTimeoutConfigSchema.shape);

/** The validated OpenAI provider configuration, inferred from {@link openAiConfigSchema}. */
export type OpenAiConfig = z.infer<typeof openAiConfigSchema>;
