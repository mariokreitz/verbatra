import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { StructuredError } from "../../client/state.js";
import type { GlossaryGetResult } from "../../shared/rpc/glossary.js";
import type { ProjectSnapshotResult } from "../../shared/rpc/snapshot.js";
import { rpcClient } from "../api.js";
import { Card } from "../Card.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../Table.js";
import { DetailList, EmptyState, MonoValue, Section } from "../ui.js";

/** A small labeled stat card, the panel's at-a-glance row (source locale, targets, format, provider). */
function StatCard({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <Card padding="sm">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-mono text-sm text-foreground" title={value}>
        {value}
      </dd>
    </Card>
  );
}

function OverviewStats({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  return (
    <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Source locale" value={snapshot.sourceLocale} />
      <StatCard label="Target locales" value={String(snapshot.targetLocales.length)} />
      <StatCard label="Format" value={snapshot.format} />
      <StatCard label="Provider" value={snapshot.provider.id} />
    </dl>
  );
}

type OverviewState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: StructuredError }
  | {
      readonly status: "loaded";
      readonly snapshot: ProjectSnapshotResult;
      readonly glossary: GlossaryGetResult;
    };

function OverviewDetails({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  const items: Array<readonly [string, ReactNode]> = [
    ["Source locale", <MonoValue key="source-locale">{snapshot.sourceLocale}</MonoValue>],
    [
      "Target locales",
      <MonoValue key="target-locales">{snapshot.targetLocales.join(", ")}</MonoValue>,
    ],
    ["Format", <MonoValue key="format">{snapshot.format}</MonoValue>],
    ["File pattern", <MonoValue key="file-pattern">{snapshot.files.pattern}</MonoValue>],
    ["Provider", <MonoValue key="provider">{snapshot.provider.id}</MonoValue>],
    ["Config source", <MonoValue key="config-source">{snapshot.configSource}</MonoValue>],
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
    return <EmptyState>No glossary configured.</EmptyState>;
  }
  return (
    <Table>
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
  );
}

function GlossarySection({ glossary }: { readonly glossary: GlossaryGetResult }): ReactNode {
  return (
    <Section title="Glossary" intro={`Source: ${glossaryIndicatorLabel(glossary)}`}>
      <GlossaryEntries entries={glossary.entries} />
    </Section>
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
      <OverviewStats snapshot={state.snapshot} />
      <Section title="Project">
        <OverviewDetails snapshot={state.snapshot} />
      </Section>
      <GlossarySection glossary={state.glossary} />
    </div>
  );
}
