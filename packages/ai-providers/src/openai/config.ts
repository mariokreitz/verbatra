import { z } from "zod";
import { requestTimeoutConfigSchema } from "../request-timeout-config.js";

export const openAiConfigSchema = z
  .object({
    model: z.string().min(1),
    maxOutputTokens: z.number().int().positive(),
  })
  .extend(requestTimeoutConfigSchema.shape);

export type OpenAiConfig = z.infer<typeof openAiConfigSchema>;
