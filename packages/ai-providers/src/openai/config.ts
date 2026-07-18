import { z } from "zod";

/**
 * Provider-specific configuration for the OpenAI provider. The API key is not here;
 * it is read only from the environment.
 */
export const openAiConfigSchema = z.object({
  model: z.string().min(1),
  maxOutputTokens: z.number().int().positive(),
  /**
   * Optional verbatra-imposed per-request timeout in milliseconds. A positive integer; when absent,
   * the shared default request timeout applies. Bounds each outbound request so a hung-but-alive
   * server cannot hold a locale's write lock open forever.
   */
  requestTimeoutMs: z.number().int().positive().optional(),
});

/** The validated OpenAI provider configuration, inferred from {@link openAiConfigSchema}. */
export type OpenAiConfig = z.infer<typeof openAiConfigSchema>;
