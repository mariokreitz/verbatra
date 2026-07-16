import type { ReactNode } from "react";
import type { BudgetDisplay, UsageDisplay } from "../../client/usage-ticker-data.js";
import { toUsageTickerDisplayState } from "../../client/usage-ticker-data.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import type { PanelProps } from "../panel-props.js";
import { DetailList, EmptyState, MonoValue } from "../ui.js";
import { useUsageTicker } from "../use-usage-ticker.js";

function usageItems(usage: UsageDisplay): Array<readonly [string, ReactNode]> {
  if (usage.kind === "not-reported") {
    return [["Tokens", "Not reported by this provider."]];
  }
  return [
    ["Input tokens", <MonoValue key="input-tokens">{usage.inputTokens}</MonoValue>],
    ["Output tokens", <MonoValue key="output-tokens">{usage.outputTokens}</MonoValue>],
  ];
}

function budgetItems(budget: BudgetDisplay): Array<readonly [string, ReactNode]> {
  if (budget.kind === "none") {
    return [];
  }
  if (budget.kind === "not-tracked") {
    return [
      ["Budget ceiling", <MonoValue key="budget-ceiling">{budget.maxTokens}</MonoValue>],
      ["Budget status", "Not tracked for this provider."],
    ];
  }
  return [
    [
      "Budget ceiling",
      <MonoValue key="budget-ceiling">
        {budget.tokensUsed} / {budget.maxTokens}
      </MonoValue>,
    ],
    ["Budget behavior", <MonoValue key="budget-behavior">{budget.behavior}</MonoValue>],
    [
      "Budget status",
      <Badge tone={budget.exceeded ? "danger" : "success"} key="budget-status">
        {budget.exceeded ? "Ceiling reached" : "Within budget"}
      </Badge>,
    ],
  ];
}

/**
 * The run-wide token/budget ticker: the most recently persisted run's token totals and, when a
 * budget was configured for that run, its ceiling, behavior, and whether it was reached. Purely a
 * display surface (see `.verbatra/specs/studio-usage-ticker.md`): it never gates or blocks
 * anything itself, and the `generatedAt` timestamp is always shown alongside the totals so this
 * reads as "as of the last recorded run", never as a live, in-progress counter. Only a sdk
 * translate or watch run (CLI-triggered or via Studio's own `translation.translatePending`) ever
 * changes what this shows; opening or reloading Studio does not.
 */
export function UsagePanel({ refreshToken }: PanelProps): ReactNode {
  const view = useUsageTicker(refreshToken);

  if (view.kind === "loading") {
    return <Loading />;
  }
  if (view.kind === "error") {
    return <ErrorMessage error={view.error} />;
  }

  const state = toUsageTickerDisplayState(view.data);

  if (state.kind === "unavailable") {
    return (
      <EmptyState>
        No run has been recorded yet. Run <code>verbatra translate</code> or{" "}
        <code>verbatra watch</code> to populate this ticker.
      </EmptyState>
    );
  }

  return (
    <div>
      {view.stale && <ErrorMessage error={view.error} prefix="Showing the last known usage." />}
      <p className="mb-3 text-sm text-muted-foreground">
        As of {new Date(state.generatedAt).toLocaleString()}
      </p>
      <DetailList items={[...usageItems(state.usage), ...budgetItems(state.budget)]} />
    </div>
  );
}
