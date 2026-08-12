import { z } from "zod";

/**
 * The requestTimeoutMs field every provider config schema merges in via `.extend()`. Optional
 * verbatra-imposed per-request timeout in milliseconds. A positive integer; when absent, the shared
 * default request timeout applies. Bounds each outbound request so a hung-but-alive server cannot
 * hold a locale's write lock open forever.
 */
export const requestTimeoutConfigSchema = z.object({
  requestTimeoutMs: z.number().int().positive().optional(),
});
