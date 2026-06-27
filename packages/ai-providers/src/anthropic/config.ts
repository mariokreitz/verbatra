import { z } from "zod";

/**
 * Configuration for the Anthropic provider: the required model and max-tokens. The
 * API key is deliberately absent here; it is read only from the environment.
 */
export const anthropicConfigSchema = z.object({
  model: z.string().min(1),
  maxTokens: z.number().int().positive(),
});

export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>;
