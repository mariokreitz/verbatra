import { z } from "zod";

/**
 * DeepL provider configuration. `glossaryId` is an existing DeepL glossary ID passed
 * natively to translateText. The API key is intentionally absent: it is read only from
 * the environment.
 */
export const deepLConfigSchema = z.object({
  glossaryId: z.string().min(1).optional(),
  /**
   * Optional verbatra-imposed per-request timeout in milliseconds. A positive integer; when absent,
   * the shared default request timeout applies. Bounds each outbound request so a hung-but-alive
   * server cannot hold a locale's write lock open forever. deepl-node cannot cancel an in-flight
   * request, so on timeout verbatra's await is released but the underlying request is left to settle.
   */
  requestTimeoutMs: z.number().int().positive().optional(),
});

/** The validated DeepL provider configuration, inferred from {@link deepLConfigSchema}. */
export type DeepLConfig = z.infer<typeof deepLConfigSchema>;
