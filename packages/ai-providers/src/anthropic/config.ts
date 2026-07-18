import { z } from "zod";

/**
 * Configuration for the Anthropic provider: the required model and max-tokens. The
 * API key is deliberately absent here; it is read only from the environment.
 */
export const anthropicConfigSchema = z.object({
  model: z.string().min(1),
  maxTokens: z.number().int().positive(),
  /**
   * Optional verbatra-imposed per-request timeout in milliseconds. A positive integer; when absent,
   * the shared default request timeout applies. Bounds each outbound request so a hung-but-alive
   * server cannot hold a locale's write lock open forever.
   */
  requestTimeoutMs: z.number().int().positive().optional(),
});

/** The validated Anthropic provider configuration, inferred from {@link anthropicConfigSchema}. */
export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>;
