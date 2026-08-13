import type { Usage } from "@verbatra/ai-providers";
import type { BudgetBehavior, RunBudget, SdkNotice } from "./summary.js";

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

export function foldTrackerUsage(tracker: BudgetTracker, usage: Usage | undefined): void {
  if (usage === undefined) {
    return;
  }
  tracker.usageSeen = true;
  tracker.tokensUsed += usage.inputTokens + usage.outputTokens;
}

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

export function budgetExceededNotice(tracker: BudgetTracker): SdkNotice {
  return {
    code: "BUDGET_TOKENS_EXCEEDED",
    message:
      `The run's cumulative token usage (${tracker.tokensUsed}) reached the configured budget of ` +
      `${tracker.maxTokens} tokens (behavior: ${tracker.behavior}).`,
  };
}
