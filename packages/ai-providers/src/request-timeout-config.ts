import { z } from "zod";

export const requestTimeoutConfigSchema = z.object({
  requestTimeoutMs: z.number().int().positive().optional(),
});
