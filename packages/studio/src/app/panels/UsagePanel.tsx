import type { ReactNode } from "react";
import type { BudgetDisplay, UsageDisplay } from "../../client/usage-ticker-data.js";
import { budgetPercent, toUsageTickerDisplayState } from "../../client/usage-ticker-data.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import { MetricCard } from "../MetricCard.js";
import { PageHeader } from "../PageHeader.js";
import type { PanelProps } from "../panel-props.js";
import { EmptyState } from "../ui.js";
import { useUsageTicker } from "../use-usage-ticker.js";

/** The run's token totals as metric tiles, or one explicit not-reported tile: an absent figure
 * is a fact about the provider, never rendered as a fabricated zero. */
function UsageCards({ usage }: { readonly usage: UsageDisplay }): ReactNode {
  if (usage.kind === "not-reported") {
    return (
      <MetricCard
        label="Tokens"
        icon="gauge"
        value="Not reported"
        hint="This provider does not report token usage."
      />
    );
  }
  return (
    <>
      <MetricCard label="Input tokens" icon="gauge" value={usage.inputTokens.toLocaleString()} />
      <MetricCard label="Output tokens" icon="gauge" value={usage.outputTokens.toLocaleString()} />
    </>
  );
}

/** The budget tiles for the two renderable budget arms; a run without a budget renders nothing,
 * exactly as before. The consumed meter turns danger-toned only off the run's own exceeded flag,
 * never re-derived from the percentage. */
function BudgetCards({ budget }: { readonly budget: BudgetDisplay }): ReactNode {
  if (budget.kind === "none") {
    return null;
  }
  if (budget.kind === "not-tracked") {
    return (
      <MetricCard
        label="Budget ceiling"
        value={budget.maxTokens.toLocaleString()}
        hint="Not tracked for this provider."
      />
    );
  }
  return (
    <>
      <MetricCard
        label="Budget"
        value={`${budget.tokensUsed.toLocaleString()} / ${budget.maxTokens.toLocaleString()}`}
        hint={`Behavior: ${budget.behavior}`}
        progress={budgetPercent(budget)}
        progressTone={budget.exceeded ? "danger" : "primary"}
      />
      <MetricCard
        label="Budget status"
        value={
          <Badge tone={budget.exceeded ? "danger" : "success"}>
            {budget.exceeded ? "Ceiling reached" : "Within budget"}
          </Badge>
        }
      />
    </>
  );
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
  return (
    <>
      <PageHeader
        title="Usage"
        description="Token usage and budget from the most recent recorded run."
      />
      <UsagePanelBody refreshToken={refreshToken} />
    </>
  );
}

function UsagePanelBody({ refreshToken }: PanelProps): ReactNode {
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
      <EmptyState icon="gauge" title="No run recorded yet">
        Run <code>verbatra translate</code> or <code>verbatra watch</code> to populate this ticker.
      </EmptyState>
    );
  }

  return (
    <div>
      {view.stale && <ErrorMessage error={view.error} prefix="Showing the last known usage." />}
      <p className="mb-4 text-sm text-muted-foreground">
        As of {new Date(state.generatedAt).toLocaleString()}
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UsageCards usage={state.usage} />
        <BudgetCards budget={state.budget} />
      </div>
    </div>
  );
}
