import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { StructuredError } from "../../client/state.js";
import type { GlossaryGetResult } from "../../shared/rpc/glossary.js";
import type { ProjectSnapshotResult } from "../../shared/rpc/snapshot.js";
import { rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import { MetricCard } from "../MetricCard.js";
import { PageHeader } from "../PageHeader.js";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../Table.js";
import { DetailList, EmptyState, MonoValue, SectionCard } from "../ui.js";

/** The at-a-glance figure strip: the four facts someone opens this page to confirm. */
function ProjectMetrics({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Source locale" value={snapshot.sourceLocale} />
      <MetricCard
        label="Target locales"
        value={String(snapshot.targetLocales.length)}
        hint={snapshot.targetLocales.join(", ")}
      />
      <MetricCard label="Format" value={snapshot.format} />
      <MetricCard label="Provider" value={snapshot.provider.id} />
    </div>
  );
}

type ProjectState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: StructuredError }
  | {
      readonly status: "loaded";
      readonly snapshot: ProjectSnapshotResult;
      readonly glossary: GlossaryGetResult;
    };

/**
 * The configuration facts the metric strip does not already carry: the full target-locale list
 * (the strip only shows the count), the file pattern, and whichever optional settings are
 * configured. Source locale, format, and provider are deliberately not repeated here.
 */
function ProjectDetails({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  const items: Array<readonly [string, ReactNode]> = [
    [
      "Target locales",
      <MonoValue key="target-locales">{snapshot.targetLocales.join(", ")}</MonoValue>,
    ],
    ["File pattern", <MonoValue key="file-pattern">{snapshot.files.pattern}</MonoValue>],
  ];
  if (snapshot.prune !== undefined) {
    items.push(["Prune", snapshot.prune ? "yes" : "no"]);
  }
  if (snapshot.generatePlurals !== undefined) {
    items.push(["Generate plurals", snapshot.generatePlurals ? "yes" : "no"]);
  }
  if (snapshot.maxBatchSize !== undefined) {
    items.push(["Max batch size", String(snapshot.maxBatchSize)]);
  }
  if (snapshot.tone !== undefined) {
    items.push(["Tone", snapshot.tone]);
  }
  return <DetailList items={items} />;
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
    return (
      <EmptyState title="No glossary configured">
        Add a glossary to keep brand terms and fixed vocabulary consistent across locales.
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[320px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Source term</TableHeaderCell>
            <TableHeaderCell>Preferred translation</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {terms.map(([term, translation]) => (
            <TableRow key={term}>
              <TableCell mono>{term}</TableCell>
              {/* The glossary has no per-entry locale (it is one project-wide term map, see
                  sdk's VerbatraConfig.glossary), so which locale's script a preferred term is
                  written in cannot be known here. dir="auto" lets the browser infer direction
                  from the value's own first strong character instead of guessing a locale. */}
              <TableCell dir="auto">{translation}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GlossarySection({ glossary }: { readonly glossary: GlossaryGetResult }): ReactNode {
  const termCount = Object.keys(glossary.entries).length;
  return (
    <SectionCard
      title="Glossary"
      intro={`Source: ${glossaryIndicatorLabel(glossary)}`}
      className="mb-0"
      meta={
        termCount > 0 ? (
          <Badge tone="neutral">
            {termCount} {termCount === 1 ? "term" : "terms"}
          </Badge>
        ) : undefined
      }
    >
      <GlossaryEntries entries={glossary.entries} />
    </SectionCard>
  );
}

/**
 * The reference page for how this project is configured: a read-only view of the resolved
 * config snapshot (project.snapshot) and the glossary (glossary.get), both independent,
 * stateless reads made fresh on every mount. Demoted from a primary workspace to the sidebar's
 * reference zone: nothing here changes day to day, and nothing here is actionable inside a
 * read-only dashboard.
 */
export function ProjectPanel(): ReactNode {
  return (
    <>
      <PageHeader
        title="Project"
        description="The resolved configuration and glossary this Studio session was started with."
      />
      <ProjectPanelBody />
    </>
  );
}

function ProjectPanelBody(): ReactNode {
  const [state, setState] = useState<ProjectState>({ status: "loading" });

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
        setState({ status: "error", error: snapshotResponse.error });
        return;
      }
      if (!glossaryResponse.ok) {
        setState({ status: "error", error: glossaryResponse.error });
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
    return <ErrorMessage error={state.error} />;
  }
  return (
    <div>
      <ProjectMetrics snapshot={state.snapshot} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SectionCard
          title="Configuration"
          intro={`Loaded from ${state.snapshot.configSource}`}
          className="mb-0"
        >
          <ProjectDetails snapshot={state.snapshot} />
        </SectionCard>
        <GlossarySection glossary={state.glossary} />
      </div>
    </div>
  );
}
