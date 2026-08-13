import { z } from "zod";
import { requestTimeoutConfigSchema } from "../request-timeout-config.js";

export const deepLConfigSchema = z
  .object({
    glossaryId: z.string().min(1).optional(),
  })
  .extend(requestTimeoutConfigSchema.shape);

export type DeepLConfig = z.infer<typeof deepLConfigSchema>;
