import type { ReactNode } from "react";
import type { BudgetDisplay, UsageDisplay } from "../../client/usage-ticker-data.js";
import { budgetPercent, toUsageTickerDisplayState } from "../../client/usage-ticker-data.js";
import { Badge } from "../Badge.js";
import { CommitList } from "../CommitList.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import { MetricCard } from "../MetricCard.js";
import { PageHeader } from "../PageHeader.js";
import type { PanelProps } from "../panel-props.js";
import { EmptyState, PageSection } from "../ui.js";
import { useHistoryList } from "../use-history-list.js";
import { useUsageTicker } from "../use-usage-ticker.js";

/** The run's token totals as metric tiles, or one explicit not-reported tile:
 * an absent figure is never rendered as a fabricated zero. */
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

/** The budget tiles for the two renderable budget arms; a run without a
 * budget renders nothing. The meter turns danger-toned only off the run's own
 * exceeded flag, never re-derived from the percentage. */
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
 * The last recorded run's token and budget snapshot, the page's side rail.
 * Purely a display surface; the `generatedAt` timestamp is always shown so
 * this reads as "as of the last recorded run", never a live counter.
 * Re-fetches on every live-refresh event, keeping the last good data with a
 * stale banner when a re-fetch fails.
 */
function LastRunRail({ refreshToken }: PanelProps): ReactNode {
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
        Run <code>verbatra translate</code> or <code>verbatra watch</code> to record one.
      </EmptyState>
    );
  }

  return (
    <div>
      {view.stale && <ErrorMessage error={view.error} prefix="Showing the last known usage." />}
      <p className="mb-3 text-xs text-muted-foreground">
        As of {new Date(state.generatedAt).toLocaleString()}
      </p>
      <div className="grid grid-cols-1 gap-3">
        <UsageCards usage={state.usage} />
        <BudgetCards budget={state.budget} />
      </div>
    </div>
  );
}

/**
 * The Activity page: the locale files' commit feed and the last run's token
 * and budget snapshot side by side. The feed comes from `history.list`; a
 * project without git renders history as unavailable rather than an error.
 */
export function ActivityPanel({ refreshToken }: PanelProps): ReactNode {
  const history = useHistoryList(refreshToken);

  return (
    <>
      <PageHeader
        kicker="Reference"
        title="Activity"
        description="What the last run did, and how the locale files have changed."
      />
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PageSection title="Locale file history" className="mb-0 lg:col-start-1 lg:row-start-1">
          <CommitList
            state={history}
            emptyMessage="No commit history yet for the source or target locale files."
          />
        </PageSection>
        <PageSection title="Last run" className="mb-0 lg:col-start-2 lg:row-start-1">
          <LastRunRail refreshToken={refreshToken} />
        </PageSection>
      </div>
    </>
  );
}
