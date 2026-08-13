import type { DiffSummary } from "@verbatra/sdk";
import { z } from "zod";

export const STATUS_DIFF_METHOD = "status.diff";

export const statusDiffParamsSchema = z.strictObject({
  locales: z.array(z.string().min(1)).min(1).optional(),
});

export type StatusDiffParams = z.infer<typeof statusDiffParamsSchema>;

export type StatusDiffResult = DiffSummary;
