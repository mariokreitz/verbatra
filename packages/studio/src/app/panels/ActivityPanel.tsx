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
 * The last recorded run's token/budget snapshot, the page's side rail. Purely a display surface:
 * it never gates or blocks anything, and the `generatedAt` timestamp is always shown so this
 * reads as "as of the last recorded run", never a live counter. Only a sdk translate or watch
 * run (CLI-triggered or via Studio's own translate-pending action) ever changes it; opening or
 * reloading Studio does not. Re-fetches on every live-refresh event with the covered
 * keep-last-good-data behavior and its stale banner.
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
 * The audit trail: what the most recent run did and cost (the side rail) and how the locale
 * files have changed over time (the commit feed), merged from what used to be two separate
 * pages answering the same "what happened?" question. The feed comes from `git log` through
 * `history.list`, fetched once per mount, bounded, and never `--follow`; a project without git
 * renders history as unavailable rather than an error.
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
