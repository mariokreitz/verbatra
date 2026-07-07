import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { ProjectSnapshotResult } from "../../shared/rpc/snapshot.js";
import { rpcClient } from "../api.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";

type OverviewState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "loaded"; readonly snapshot: ProjectSnapshotResult };

function OverviewDetails({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  return (
    <dl className="detail-list">
      <dt>Source locale</dt>
      <dd className="detail-value-mono">{snapshot.sourceLocale}</dd>
      <dt>Target locales</dt>
      <dd className="detail-value-mono">{snapshot.targetLocales.join(", ")}</dd>
      <dt>Format</dt>
      <dd className="detail-value-mono">{snapshot.format}</dd>
      <dt>Provider</dt>
      <dd className="detail-value-mono">{snapshot.provider.id}</dd>
      <dt>Config source</dt>
      <dd className="detail-value-mono">{snapshot.configSource}</dd>
      <dt>Glossary</dt>
      <dd>{snapshot.glossary.source}</dd>
    </dl>
  );
}

/** The default landing tab: a read-only view of the project's configuration snapshot. */
export function OverviewPanel(): ReactNode {
  const [state, setState] = useState<OverviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("project.snapshot", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (response.ok) {
        setState({ status: "loaded", snapshot: response.result });
      } else {
        setState({ status: "error", message: response.error.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <Loading />;
  }
  if (state.status === "error") {
    return <ErrorMessage message={state.message} />;
  }
  return <OverviewDetails snapshot={state.snapshot} />;
}
