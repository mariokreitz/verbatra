import { z } from "zod";

/**
 * Provider-specific configuration for the Anthropic provider. The model is required
 * and never hardcoded in provider logic; max-tokens is required and set on every
 * request. The API key is deliberately NOT here: it is read only from the environment.
 */
export const anthropicConfigSchema = z.object({
  model: z.string().min(1),
  maxTokens: z.number().int().positive(),
});

export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>;
