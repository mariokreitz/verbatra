import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { StatusRow, StatusView } from "../../client/coverage.js";
import { deriveStatusView } from "../../client/coverage.js";
import { rpcClient } from "../api.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";

function StatusRowView({ row }: { readonly row: StatusRow }): ReactNode {
  return (
    <tr>
      <td>{row.locale}</td>
      <td>{row.percent}%</td>
      <td>{row.missing}</td>
      <td>{row.stale}</td>
      <td>{row.upToDate}</td>
      <td>{row.inSync ? "yes" : "no"}</td>
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
      <p>Overall status: {inSync ? "in sync" : "out of sync"}</p>
      <table>
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

/** Per-locale translation drift, from the sdk's read-only `check` through `status.check`. */
export function StatusPanel(): ReactNode {
  const [view, setView] = useState<StatusView>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("status.check", {}).then((response) => {
      if (!cancelled) {
        setView(deriveStatusView(response));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === "loading") {
    return <Loading />;
  }
  if (view.kind === "error") {
    return <ErrorMessage message={view.message} />;
  }
  return <StatusTable inSync={view.inSync} rows={view.rows} />;
}
