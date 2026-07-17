import type { RunSummary } from "@verbatra/sdk";
import { z } from "zod";

/**
 * The RPC method name for the whole-project "translate pending changes" action: brings every
 * configured target locale current against the source, exactly like `verbatra translate`.
 */
export const TRANSLATE_PENDING_METHOD = "translation.translatePending";

/**
 * Empty by design: the action is always whole-project, never scoped to one locale. Declared
 * unconditionally in the shared contract, independent of which capability flags a given server
 * instance was started with, matching every other write method's params schema. A call with any
 * unexpected key fails `PARAMS_INVALID` because this is a `strictObject`.
 */
export const translatePendingParamsSchema = z.strictObject({});

/** Parsed `translation.translatePending` params. */
export type TranslatePendingParams = z.infer<typeof translatePendingParamsSchema>;

/**
 * The sdk's own `RunSummary`, unchanged shape: `dryRun`, one `LocaleSummary` per target locale,
 * `succeeded`/`failed` locale lists, and optional `usage`/`budget`. Exposing `LocaleSummary`'s
 * key-name arrays over this RPC does not cross the SSE "counts only, never key names" boundary:
 * that rule is specific to the passive SSE channel, not RPC responses (`key.integrity` and
 * `review.queue` already expose key names, and the always-registered `key.value` already exposes
 * raw string content). `RunSummary` carries no translated-content field at all.
 */
export type TranslatePendingResult = RunSummary;
