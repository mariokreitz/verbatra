import { z } from "zod";
import { requestTimeoutConfigSchema } from "../request-timeout-config.js";

/**
 * DeepL provider configuration, plus the shared requestTimeoutMs field. `glossaryId` is an existing
 * DeepL glossary ID passed natively to translateText. The API key is intentionally absent: it is
 * read only from the environment.
 *
 * deepl-node cannot cancel an in-flight request, so on a requestTimeoutMs timeout verbatra's await is
 * released but the underlying request is left to settle.
 */
export const deepLConfigSchema = z
  .object({
    glossaryId: z.string().min(1).optional(),
  })
  .extend(requestTimeoutConfigSchema.shape);

/** The validated DeepL provider configuration, inferred from {@link deepLConfigSchema}. */
export type DeepLConfig = z.infer<typeof deepLConfigSchema>;
