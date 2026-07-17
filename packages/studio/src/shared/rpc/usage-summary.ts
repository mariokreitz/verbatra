import type { RunBudget, UsageSummary } from "@verbatra/sdk";
import { z } from "zod";

/** The RPC method name for the run-wide token/budget ticker. */
export const USAGE_SUMMARY_METHOD = "usage.summary";

/** Takes no parameters: the ticker always reflects the single loaded project's persisted run-status snapshot. */
export const usageSummaryParamsSchema = z.strictObject({});

/** Parsed `usage.summary` params. */
export type UsageSummaryParams = z.infer<typeof usageSummaryParamsSchema>;

/**
 * A projection of the sdk's `runStatus()` result onto only its run-wide fields: `{ available: false }`
 * under the same conditions `runStatus()` itself reports it (no run has ever persisted a snapshot, or
 * the file is missing, corrupt, or at an unrecognized version), or `generatedAt`/`usage`/`budget` taken
 * from the persisted `RunStatusFile` unmodified. Unlike `ReviewQueueResult`, this deliberately drops
 * `version` and the per-locale `locales` array (and, inside it, per-locale `needsReview`/`usage`):
 * this method is the run-wide ticker, never a per-locale view, and `review.queue` already owns that.
 */
export type UsageSummaryResult =
  | { readonly available: false }
  | {
      readonly available: true;
      readonly generatedAt: string;
      /** Absent exactly when the persisted snapshot's own run-wide `usage` was absent; never a fabricated zero. */
      readonly usage?: UsageSummary;
      /** Present only when a token budget was configured for that run. */
      readonly budget?: RunBudget;
    };
