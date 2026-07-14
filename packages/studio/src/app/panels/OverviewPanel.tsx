import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { GlossaryGetResult } from "../../shared/rpc/glossary.js";
import type { ProjectSnapshotResult } from "../../shared/rpc/snapshot.js";
import { rpcClient } from "../api.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";

type OverviewState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "loaded";
      readonly snapshot: ProjectSnapshotResult;
      readonly glossary: GlossaryGetResult;
    };

function OverviewDetails({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  return (
    <dl className="detail-list">
      <dt>Source locale</dt>
      <dd className="detail-value-mono">{snapshot.sourceLocale}</dd>
      <dt>Target locales</dt>
      <dd className="detail-value-mono">{snapshot.targetLocales.join(", ")}</dd>
      <dt>Format</dt>
      <dd className="detail-value-mono">{snapshot.format}</dd>
      <dt>File pattern</dt>
      <dd className="detail-value-mono">{snapshot.files.pattern}</dd>
      <dt>Provider</dt>
      <dd className="detail-value-mono">{snapshot.provider.id}</dd>
      <dt>Config source</dt>
      <dd className="detail-value-mono">{snapshot.configSource}</dd>
      {snapshot.prune !== undefined ? (
        <>
          <dt>Prune</dt>
          <dd>{snapshot.prune ? "yes" : "no"}</dd>
        </>
      ) : null}
      {snapshot.generatePlurals !== undefined ? (
        <>
          <dt>Generate plurals</dt>
          <dd>{snapshot.generatePlurals ? "yes" : "no"}</dd>
        </>
      ) : null}
      {snapshot.maxBatchSize !== undefined ? (
        <>
          <dt>Max batch size</dt>
          <dd>{snapshot.maxBatchSize}</dd>
        </>
      ) : null}
      {snapshot.tone !== undefined ? (
        <>
          <dt>Tone</dt>
          <dd>{snapshot.tone}</dd>
        </>
      ) : null}
    </dl>
  );
}

function glossaryIndicatorLabel(glossary: GlossaryGetResult): string {
  if (glossary.indicator.source === "file") {
    return `file (${glossary.indicator.path})`;
  }
  return glossary.indicator.source;
}

function GlossaryEntries({
  entries,
}: {
  readonly entries: Readonly<Record<string, string>>;
}): ReactNode {
  const terms = Object.entries(entries);
  if (terms.length === 0) {
    return <p className="empty-state">No glossary configured.</p>;
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Source term</th>
          <th>Preferred translation</th>
        </tr>
      </thead>
      <tbody>
        {terms.map(([term, translation]) => (
          <tr key={term}>
            <td className="mono">{term}</td>
            {/* The glossary has no per-entry locale (it is one project-wide term map, see
                sdk's VerbatraConfig.glossary), so which locale's script a preferred term is
                written in cannot be known here. dir="auto" lets the browser infer direction
                from the value's own first strong character instead of guessing a locale. */}
            <td dir="auto">{translation}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GlossarySection({ glossary }: { readonly glossary: GlossaryGetResult }): ReactNode {
  return (
    <section className="panel-section">
      <h3>Glossary</h3>
      <p className="panel-intro">Source: {glossaryIndicatorLabel(glossary)}</p>
      <GlossaryEntries entries={glossary.entries} />
    </section>
  );
}

/**
 * The default landing tab: a read-only view of the project's configuration snapshot
 * (project.snapshot) and its resolved glossary (glossary.get). Both are independent, stateless
 * reads made fresh on every mount. This merges what used to be two separate tabs, Overview and
 * Config: Config's field set was a strict superset of Overview's (the same snapshot fields plus
 * file pattern, prune, generatePlurals, maxBatchSize, tone, and the full glossary table Overview
 * only summarized by source), so splitting them across two clicks cost navigation with no
 * offsetting benefit.
 */
export function OverviewPanel(): ReactNode {
  const [state, setState] = useState<OverviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      rpcClient.call("project.snapshot", {}),
      rpcClient.call("glossary.get", {}),
    ]).then(([snapshotResponse, glossaryResponse]) => {
      if (cancelled) {
        return;
      }
      if (!snapshotResponse.ok) {
        setState({ status: "error", message: snapshotResponse.error.message });
        return;
      }
      if (!glossaryResponse.ok) {
        setState({ status: "error", message: glossaryResponse.error.message });
        return;
      }
      setState({
        status: "loaded",
        snapshot: snapshotResponse.result,
        glossary: glossaryResponse.result,
      });
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
  return (
    <div>
      <div className="panel-section">
        <OverviewDetails snapshot={state.snapshot} />
      </div>
      <GlossarySection glossary={state.glossary} />
    </div>
  );
}
