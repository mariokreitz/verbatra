import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { GlossaryGetResult } from "../../shared/rpc/glossary.js";
import type { ProjectSnapshotResult } from "../../shared/rpc/snapshot.js";
import { rpcClient } from "../api.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";

type ConfigPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "loaded";
      readonly snapshot: ProjectSnapshotResult;
      readonly glossary: GlossaryGetResult;
    };

function ConfigDetails({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  return (
    <dl>
      <dt>Source locale</dt>
      <dd>{snapshot.sourceLocale}</dd>
      <dt>Target locales</dt>
      <dd>{snapshot.targetLocales.join(", ")}</dd>
      <dt>Format</dt>
      <dd>{snapshot.format}</dd>
      <dt>File pattern</dt>
      <dd>{snapshot.files.pattern}</dd>
      <dt>Provider</dt>
      <dd>{snapshot.provider.id}</dd>
      <dt>Config source</dt>
      <dd>{snapshot.configSource}</dd>
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
    return <p>No glossary configured.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Source term</th>
          <th>Preferred translation</th>
        </tr>
      </thead>
      <tbody>
        {terms.map(([term, translation]) => (
          <tr key={term}>
            <td>{term}</td>
            <td>{translation}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GlossarySection({ glossary }: { readonly glossary: GlossaryGetResult }): ReactNode {
  return (
    <section>
      <h3>Glossary</h3>
      <p>Source: {glossaryIndicatorLabel(glossary)}</p>
      <GlossaryEntries entries={glossary.entries} />
    </section>
  );
}

/**
 * Read-only viewer for the loaded config's allowlisted projection (project.snapshot) and its
 * resolved glossary (glossary.get). Both are independent, stateless reads made fresh on every
 * mount, matching the Overview panel's pattern for project.snapshot. Strictly a viewer: nothing
 * here writes, edits, or saves any config or glossary value.
 */
export function ConfigPanel(): ReactNode {
  const [state, setState] = useState<ConfigPanelState>({ kind: "loading" });

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
        setState({ kind: "error", message: snapshotResponse.error.message });
        return;
      }
      if (!glossaryResponse.ok) {
        setState({ kind: "error", message: glossaryResponse.error.message });
        return;
      }
      setState({
        kind: "loaded",
        snapshot: snapshotResponse.result,
        glossary: glossaryResponse.result,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return <Loading />;
  }
  if (state.kind === "error") {
    return <ErrorMessage message={state.message} />;
  }
  return (
    <div>
      <section>
        <h3>Config</h3>
        <ConfigDetails snapshot={state.snapshot} />
      </section>
      <GlossarySection glossary={state.glossary} />
    </div>
  );
}
