import { z } from "zod";
import { requestTimeoutConfigSchema } from "../request-timeout-config.js";

/**
 * Configuration for the Anthropic provider: the required model and max-tokens, plus the shared
 * requestTimeoutMs field. The API key is deliberately absent here; it is read only from the
 * environment.
 */
export const anthropicConfigSchema = z
  .object({
    model: z.string().min(1),
    maxTokens: z.number().int().positive(),
  })
  .extend(requestTimeoutConfigSchema.shape);

/** The validated Anthropic provider configuration, inferred from {@link anthropicConfigSchema}. */
export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>;
