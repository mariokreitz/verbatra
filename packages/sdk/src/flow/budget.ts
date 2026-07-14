import type { Usage } from "@verbatra/ai-providers";
import type { BudgetBehavior, RunBudget, SdkNotice } from "./summary.js";

/**
 * Mutable, run-wide token accounting shared across every locale in one `translate()` invocation.
 * Locales run strictly serially, so a single shared tracker needs no concurrency guard. `maxTokens`
 * undefined means no budget is configured: `checkTrip` is then always a no-op, `stopped` never becomes
 * true, and {@link toBudgetSummary} returns `undefined`.
 */
export interface BudgetTracker {
  readonly maxTokens: number | undefined;
  readonly behavior: BudgetBehavior;
  tokensUsed: number;
  usageSeen: boolean;
  exceeded: boolean;
  stopped: boolean;
}

export function createBudgetTracker(
  maxTokens: number | undefined,
  behavior: BudgetBehavior,
): BudgetTracker {
  return { maxTokens, behavior, tokensUsed: 0, usageSeen: false, exceeded: false, stopped: false };
}

/** Fold one completed provider call's usage into the run-wide total. Absent usage contributes nothing. */
export function foldTrackerUsage(tracker: BudgetTracker, usage: Usage | undefined): void {
  if (usage === undefined) {
    return;
  }
  tracker.usageSeen = true;
  tracker.tokensUsed += usage.inputTokens + usage.outputTokens;
}

/**
 * Check the budget after one completed sub-batch (never mid-batch; see `translate-project.ts` for why).
 * Returns `true` exactly once: the call whose completion first brings the cumulative total to or past
 * `maxTokens`. That sub-batch is never undone; in `"stop"` mode, only calls that have not started yet are
 * withheld from this point on.
 */
export function checkBudgetTrip(tracker: BudgetTracker): boolean {
  if (
    tracker.maxTokens === undefined ||
    tracker.exceeded ||
    tracker.tokensUsed < tracker.maxTokens
  ) {
    return false;
  }
  tracker.exceeded = true;
  if (tracker.behavior === "stop") {
    tracker.stopped = true;
  }
  return true;
}

/** Project the tracker to the public {@link RunBudget} shape; `undefined` when no budget is configured. */
export function toBudgetSummary(tracker: BudgetTracker): RunBudget | undefined {
  if (tracker.maxTokens === undefined) {
    return undefined;
  }
  return {
    maxTokens: tracker.maxTokens,
    behavior: tracker.behavior,
    supported: tracker.usageSeen,
    tokensUsed: tracker.tokensUsed,
    exceeded: tracker.exceeded,
  };
}

/** A secret-free notice for the locale where the budget was crossed, or a later fully-skipped locale. */
export function budgetExceededNotice(tracker: BudgetTracker): SdkNotice {
  return {
    code: "BUDGET_TOKENS_EXCEEDED",
    message:
      `The run's cumulative token usage (${tracker.tokensUsed}) reached the configured budget of ` +
      `${tracker.maxTokens} tokens (behavior: ${tracker.behavior}).`,
  };
}
