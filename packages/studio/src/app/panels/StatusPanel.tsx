import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { StatusData, StatusRow } from "../../client/coverage.js";
import { toStatusOutcome } from "../../client/coverage.js";
import type { RefreshableView } from "../../client/state.js";
import { applyRefreshOutcome } from "../../client/state.js";
import { rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import type { PanelProps } from "../panel-props.js";

function StatusRowView({ row }: { readonly row: StatusRow }): ReactNode {
  return (
    <tr>
      <td className="mono">{row.locale}</td>
      <td>{row.percent}%</td>
      <td>{row.missing}</td>
      <td>{row.stale}</td>
      <td>{row.upToDate}</td>
      <td>
        <Badge tone={row.inSync ? "success" : "warning"}>
          {row.inSync ? "In sync" : "Out of sync"}
        </Badge>
      </td>
    </tr>
  );
}

function StatusTable({
  inSync,
  rows,
}: {
  readonly inSync: boolean;
  readonly rows: readonly StatusRow[];
}): ReactNode {
  return (
    <div>
      <p className="panel-intro">
        Overall status:{" "}
        <Badge tone={inSync ? "success" : "warning"}>{inSync ? "In sync" : "Out of sync"}</Badge>
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Locale</th>
            <th>Coverage</th>
            <th>Missing</th>
            <th>Stale</th>
            <th>Up to date</th>
            <th>In sync</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StatusRowView key={row.locale} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Per-locale translation drift, from the sdk's read-only `check` through `status.check`.
 * Re-fetches on every live-refresh event (`refreshToken` changes). The keep-last-good-data
 * behavior on a failing re-fetch is not reimplemented here: every outcome is folded through
 * `client/state.ts`'s covered `applyRefreshOutcome`, the one tested place that decision lives.
 */
export function StatusPanel({ refreshToken }: PanelProps): ReactNode {
  const [view, setView] = useState<RefreshableView<StatusData>>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("status.check", {}).then((response) => {
      if (cancelled) {
        return;
      }
      const outcome = toStatusOutcome(response);
      setView((previous) => applyRefreshOutcome(previous, outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (view.kind === "loading") {
    return <Loading />;
  }
  if (view.kind === "error") {
    return <ErrorMessage message={view.error.message} />;
  }
  return (
    <div>
      {view.stale && (
        <ErrorMessage message={`Showing the last known status. ${view.error.message}`} />
      )}
      <StatusTable inSync={view.data.inSync} rows={view.data.rows} />
    </div>
  );
}
