import type { ReactNode } from "react";
import type { BudgetDisplay, UsageDisplay } from "../../client/usage-ticker-data.js";
import { toUsageTickerDisplayState } from "../../client/usage-ticker-data.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import type { PanelProps } from "../panel-props.js";
import { useUsageTicker } from "../use-usage-ticker.js";

function UsageDetails({ usage }: { readonly usage: UsageDisplay }): ReactNode {
  if (usage.kind === "not-reported") {
    return (
      <>
        <dt>Tokens</dt>
        <dd>Not reported by this provider.</dd>
      </>
    );
  }
  return (
    <>
      <dt>Input tokens</dt>
      <dd className="detail-value-mono">{usage.inputTokens}</dd>
      <dt>Output tokens</dt>
      <dd className="detail-value-mono">{usage.outputTokens}</dd>
    </>
  );
}

function BudgetDetails({ budget }: { readonly budget: BudgetDisplay }): ReactNode {
  if (budget.kind === "none") {
    return null;
  }
  if (budget.kind === "not-tracked") {
    return (
      <>
        <dt>Budget ceiling</dt>
        <dd className="detail-value-mono">{budget.maxTokens}</dd>
        <dt>Budget status</dt>
        <dd>Not tracked for this provider.</dd>
      </>
    );
  }
  return (
    <>
      <dt>Budget ceiling</dt>
      <dd className="detail-value-mono">
        {budget.tokensUsed} / {budget.maxTokens}
      </dd>
      <dt>Budget behavior</dt>
      <dd className="detail-value-mono">{budget.behavior}</dd>
      <dt>Budget status</dt>
      <dd>
        <Badge tone={budget.exceeded ? "danger" : "success"}>
          {budget.exceeded ? "Ceiling reached" : "Within budget"}
        </Badge>
      </dd>
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
      <p className="empty-state">
        No run has been recorded yet. Run <code>verbatra translate</code> or{" "}
        <code>verbatra watch</code> to populate this ticker.
      </p>
    );
  }

  return (
    <div>
      {view.stale && <ErrorMessage error={view.error} prefix="Showing the last known usage." />}
      <p className="panel-intro">As of {new Date(state.generatedAt).toLocaleString()}</p>
      <dl className="detail-list">
        <UsageDetails usage={state.usage} />
        <BudgetDetails budget={state.budget} />
      </dl>
    </div>
  );
}
