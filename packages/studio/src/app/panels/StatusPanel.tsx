import type { ReactNode } from "react";
import type { StatusRow } from "../../client/coverage.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import type { PanelProps } from "../panel-props.js";
import { TableSkeleton } from "../Skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../Table.js";
import { useStatusData } from "../use-status-data.js";

function StatusRowView({ row }: { readonly row: StatusRow }): ReactNode {
  return (
    <TableRow>
      <TableCell mono>{row.locale}</TableCell>
      <TableCell>{row.percent}%</TableCell>
      <TableCell>{row.missing}</TableCell>
      <TableCell>{row.stale}</TableCell>
      <TableCell>{row.upToDate}</TableCell>
      <TableCell>
        <Badge tone={row.inSync ? "success" : "warning"}>
          {row.inSync ? "In sync" : "Out of sync"}
        </Badge>
      </TableCell>
    </TableRow>
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
      <p className="mb-3 text-sm text-muted-foreground">
        Overall status:{" "}
        <Badge tone={inSync ? "success" : "warning"}>{inSync ? "In sync" : "Out of sync"}</Badge>
      </p>
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Locale</TableHeaderCell>
            <TableHeaderCell>Coverage</TableHeaderCell>
            <TableHeaderCell>Missing</TableHeaderCell>
            <TableHeaderCell>Stale</TableHeaderCell>
            <TableHeaderCell>Up to date</TableHeaderCell>
            <TableHeaderCell>In sync</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <StatusRowView key={row.locale} row={row} />
          ))}
        </TableBody>
      </Table>
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
      <StatusTable inSync={view.data.inSync} rows={view.data.rows} />
    </div>
  );
}
