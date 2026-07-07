import type { CheckSummary } from "@verbatra/sdk";
import { z } from "zod";

/** The RPC method name for the aggregate drift status view. */
export const STATUS_CHECK_METHOD = "status.check";

/**
 * An omitted `locales` means "all configured target locales"; an explicitly empty array is
 * rejected as invalid params rather than treated as select-none.
 */
export const statusCheckParamsSchema = z.strictObject({
  locales: z.array(z.string().min(1)).min(1).optional(),
});

export type StatusCheckParams = z.infer<typeof statusCheckParamsSchema>;

/** The result is the sdk's own {@link CheckSummary}, unchanged: counts only, no key lists. */
export type StatusCheckResult = CheckSummary;
