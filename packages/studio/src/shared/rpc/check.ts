import type { CheckSummary } from "@verbatra/sdk";
import { z } from "zod";

export const STATUS_CHECK_METHOD = "status.check";

export const statusCheckParamsSchema = z.strictObject({
  locales: z.array(z.string().min(1)).min(1).optional(),
});

export type StatusCheckParams = z.infer<typeof statusCheckParamsSchema>;

export type StatusCheckResult = CheckSummary;
