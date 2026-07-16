import type { BudgetBehavior, RunBudget, UsageSummary } from "@verbatra/sdk";
import type { RpcResultFor } from "../shared/rpc/contract.js";
import type { RpcCallResult } from "./rpc-client.js";
import type { FetchOutcome } from "./state.js";

/** The raw `usage.summary` result: `{ available: false }` or the projected run-wide snapshot. */
export type UsageTickerData = RpcResultFor<"usage.summary">;

/** The run's token totals, or the explicit absent-reporting state a token-less provider produces. */
export type UsageDisplay =
  | { readonly kind: "reported"; readonly inputTokens: number; readonly outputTokens: number }
  | { readonly kind: "not-reported" };

/**
 * The run's configured budget, projected to exactly the three shapes the ticker renders
 * differently: no budget configured at all, a budget configured but not tracked this run (the
 * configured provider never reported usage), or a budget tracked with a real `tokensUsed` figure.
 */
export type BudgetDisplay =
  | { readonly kind: "none" }
  | { readonly kind: "not-tracked"; readonly maxTokens: number; readonly behavior: BudgetBehavior }
  | {
      readonly kind: "tracked";
      readonly maxTokens: number;
      readonly behavior: BudgetBehavior;
      readonly tokensUsed: number;
      readonly exceeded: boolean;
    };

/** The ticker's full display state, derived from one `usage.summary` result with no DOM dependency. */
export type UsageTickerDisplayState =
  | { readonly kind: "unavailable" }
  | {
      readonly kind: "available";
      readonly generatedAt: string;
      readonly usage: UsageDisplay;
      readonly budget: BudgetDisplay;
    };

function toUsageDisplay(usage: UsageSummary | undefined): UsageDisplay {
  if (usage === undefined) {
    return { kind: "not-reported" };
  }
  return { kind: "reported", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
}

function toBudgetDisplay(budget: RunBudget | undefined): BudgetDisplay {
  if (budget === undefined) {
    return { kind: "none" };
  }
  if (!budget.supported) {
    return { kind: "not-tracked", maxTokens: budget.maxTokens, behavior: budget.behavior };
  }
  return {
    kind: "tracked",
    maxTokens: budget.maxTokens,
    behavior: budget.behavior,
    tokensUsed: budget.tokensUsed,
    exceeded: budget.exceeded,
  };
}

/**
 * Projects one `usage.summary` rpc result onto the ticker's display state: `{ available: false }`
 * becomes `unavailable` (an informational empty state, never an error, never a zero-value ticker);
 * an available result splits `usage` and `budget` into the three-and-two-way display shapes above,
 * so the rendering component branches on `kind` alone rather than re-deriving absence/support logic
 * itself.
 */
export function toUsageTickerDisplayState(data: UsageTickerData): UsageTickerDisplayState {
  if (!data.available) {
    return { kind: "unavailable" };
  }
  return {
    kind: "available",
    generatedAt: data.generatedAt,
    usage: toUsageDisplay(data.usage),
    budget: toBudgetDisplay(data.budget),
  };
}

/**
 * Percent of a tracked budget consumed, clamped to 0-100 for rendering as a meter. A
 * non-positive ceiling (nothing can be afforded) reads as fully consumed rather than dividing
 * by zero; the exceeded flag, not this percentage, is what gates the alarm styling.
 */
export function budgetPercent(budget: {
  readonly tokensUsed: number;
  readonly maxTokens: number;
}): number {
  if (budget.maxTokens <= 0) {
    return 100;
  }
  return Math.min(100, Math.round((budget.tokensUsed / budget.maxTokens) * 100));
}

/**
 * Maps one `usage.summary` rpc outcome to the generic {@link FetchOutcome} shape
 * `applyRefreshOutcome` (see `client/state.ts`) expects, matching `toReviewQueueOutcome`'s
 * existing precedent.
 */
export function toUsageTickerOutcome(
  response: RpcCallResult<"usage.summary">,
): FetchOutcome<UsageTickerData> {
  if (!response.ok) {
    return { ok: false, error: response.error };
  }
  return { ok: true, result: response.result };
}
