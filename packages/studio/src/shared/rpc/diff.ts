import type { DiffSummary } from "@verbatra/sdk";
import { z } from "zod";

/** The RPC method name for the detailed pending-change view. */
export const STATUS_DIFF_METHOD = "status.diff";

/**
 * An omitted `locales` means "all configured target locales"; an explicitly empty array is
 * rejected as invalid params rather than treated as select-none.
 */
export const statusDiffParamsSchema = z.strictObject({
  locales: z.array(z.string().min(1)).min(1).optional(),
});

export type StatusDiffParams = z.infer<typeof statusDiffParamsSchema>;

/** The result is the sdk's own {@link DiffSummary}, unchanged: the three key lists per locale. */
export type StatusDiffResult = DiffSummary;
