import { z } from "zod";
import { requestTimeoutConfigSchema } from "../request-timeout-config.js";

export const anthropicConfigSchema = z
  .object({
    model: z.string().min(1),
    maxTokens: z.number().int().positive(),
  })
  .extend(requestTimeoutConfigSchema.shape);

export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>;
