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
import { DetailList, EmptyState, MonoValue, SectionCard } from "../ui.js";

/** The at-a-glance strip: source locale, target-locale count, format, and provider. */
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

type SettingsState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: StructuredError }
  | {
      readonly status: "loaded";
      readonly snapshot: ProjectSnapshotResult;
      readonly glossary: GlossaryGetResult;
    };

/**
 * The configuration facts the metric strip does not already carry: the full
 * target-locale list, the file pattern, whether provider actions were enabled
 * at startup, and whichever optional settings are configured.
 */
function ProjectDetails({ snapshot }: { readonly snapshot: ProjectSnapshotResult }): ReactNode {
  const items: Array<readonly [string, ReactNode]> = [
    [
      "Target locales",
      <MonoValue key="target-locales">{snapshot.targetLocales.join(", ")}</MonoValue>,
    ],
    ["File pattern", <MonoValue key="file-pattern">{snapshot.files.pattern}</MonoValue>],
    [
      "Provider actions",
      snapshot.capabilities.spend ? (
        <Badge key="spend" tone="success">
          Enabled
        </Badge>
      ) : (
        <span key="spend">
          Off <span className="text-muted-foreground">(start with --allow-spend)</span>
        </span>
      ),
    ],
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

/**
 * The glossary's term list, or an empty state when no glossary is configured.
 * Translations render with `dir="auto"`: the glossary is one project-wide
 * term map with no per-entry locale, so the browser infers direction from
 * each value's own first strong character.
 */
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
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {terms.map(([term, translation]) => (
        <li key={term} className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <span className="font-mono text-sm font-semibold text-accent-foreground">{term}</span>
          <p className="m-0 mt-0.5 text-sm text-foreground" dir="auto">
            {translation}
          </p>
        </li>
      ))}
    </ul>
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
 * The Settings page: the resolved config snapshot (`project.snapshot`) and
 * the glossary (`glossary.get`), both fetched once per mount. This panel does
 * not react to the live-refresh token.
 */
export function SettingsPanel(): ReactNode {
  return (
    <>
      <PageHeader
        kicker="Project configuration"
        title="Settings"
        description="The resolved configuration and glossary this session was started with."
      />
      <SettingsPanelBody />
    </>
  );
}

function SettingsPanelBody(): ReactNode {
  const [state, setState] = useState<SettingsState>({ status: "loading" });

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
