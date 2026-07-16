import type { RunStatusResult } from "@verbatra/sdk";
import { z } from "zod";

/** The RPC method name for the live needs-review queue view. */
export const REVIEW_QUEUE_METHOD = "review.queue";

/** Takes no parameters: the queue always reflects the single loaded project's persisted run-status snapshot. */
export const reviewQueueParamsSchema = z.strictObject({});

export type ReviewQueueParams = z.infer<typeof reviewQueueParamsSchema>;

/**
 * The sdk's own `runStatus()` result, reused verbatim: `{ available: false }` when no run has ever
 * persisted a snapshot (or the file is missing, corrupt, or at an unrecognized version), or the
 * full persisted snapshot when one exists. No new computation is invented here; this method is a
 * pass-through, reusing `NeedsReviewEntry`/`ReviewReasonCode` from `@verbatra/sdk` the same way
 * `retranslate-entry.ts` already imports `ReviewReasonCode`.
 */
export type ReviewQueueResult = RunStatusResult;
