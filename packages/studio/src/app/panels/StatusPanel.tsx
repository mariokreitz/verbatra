import type { ReactNode } from "react";
import {
  averageCoverage,
  outOfSyncCount,
  type StatusData,
  type StatusRow,
} from "../../client/coverage.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { MetricCard } from "../MetricCard.js";
import { PageHeader } from "../PageHeader.js";
import { ProgressBar } from "../ProgressBar.js";
import type { PanelProps } from "../panel-props.js";
import { TableSkeleton } from "../Skeleton.js";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../Table.js";
import { useStatusData } from "../use-status-data.js";

/** The summary strip above the table: overall state, locale count, and mean coverage. */
function StatusMetrics({ data }: { readonly data: StatusData }): ReactNode {
  const average = averageCoverage(data.rows);
  const outOfSync = outOfSyncCount(data.rows);
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
      <MetricCard
        label="Overall"
        icon="activity"
        value={
          <Badge tone={data.inSync ? "success" : "warning"}>
            {data.inSync ? "In sync" : "Out of sync"}
          </Badge>
        }
      />
      <MetricCard
        label="Target locales"
        value={String(data.rows.length)}
        hint={outOfSync === 0 ? "All in sync" : `${outOfSync} out of sync`}
      />
      <MetricCard label="Average coverage" value={`${average}%`} progress={average} />
    </div>
  );
}

function StatusRowView({ row }: { readonly row: StatusRow }): ReactNode {
  return (
    <TableRow>
      <TableCell mono>{row.locale}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <ProgressBar percent={row.percent} className="w-24 flex-none" />
          <span className="tabular-nums text-muted-foreground">{row.percent}%</span>
        </span>
      </TableCell>
      <TableCell numeric>{row.missing}</TableCell>
      <TableCell numeric>{row.stale}</TableCell>
      <TableCell numeric>{row.upToDate}</TableCell>
      <TableCell>
        <Badge tone={row.inSync ? "success" : "warning"}>
          {row.inSync ? "In sync" : "Out of sync"}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function StatusTable({ rows }: { readonly rows: readonly StatusRow[] }): ReactNode {
  return (
    <TableCard>
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Locale</TableHeaderCell>
            <TableHeaderCell>Coverage</TableHeaderCell>
            <TableHeaderCell numeric>Missing</TableHeaderCell>
            <TableHeaderCell numeric>Stale</TableHeaderCell>
            <TableHeaderCell numeric>Up to date</TableHeaderCell>
            <TableHeaderCell>State</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <StatusRowView key={row.locale} row={row} />
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

/**
 * Per-locale translation drift, from the sdk's read-only `check` through `status.check`.
 * Re-fetches on every live-refresh event (`refreshToken` changes). The keep-last-good-data
 * behavior on a failing re-fetch is not reimplemented here: every outcome is folded through
 * `client/state.ts`'s covered `applyRefreshOutcome`, the one tested place that decision lives.
 */
export function StatusPanel({ refreshToken }: PanelProps): ReactNode {
  return (
    <>
      <PageHeader title="Status" description="Per-locale translation coverage and drift." />
      <StatusPanelBody refreshToken={refreshToken} />
    </>
  );
}

function StatusPanelBody({ refreshToken }: PanelProps): ReactNode {
  const view = useStatusData(refreshToken);

  if (view.kind === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading status…</span>
        <TableSkeleton />
      </div>
    );
  }
  if (view.kind === "error") {
    return <ErrorMessage error={view.error} />;
  }
  return (
    <div>
      {view.stale && <ErrorMessage error={view.error} prefix="Showing the last known status." />}
      <StatusMetrics data={view.data} />
      <StatusTable rows={view.data.rows} />
    </div>
  );
}
