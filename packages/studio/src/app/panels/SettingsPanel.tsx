import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { StructuredError } from "../../client/state.js";
import type { GlossaryGetResult } from "../../shared/rpc/glossary.js";
import type { ProjectSnapshotResult } from "../../shared/rpc/snapshot.js";
import { connectionStore, rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";
import { MetricCard } from "../MetricCard.js";
import { PageHeader } from "../PageHeader.js";
import { DetailList, EmptyState, MonoValue, SectionCard } from "../ui.js";
import { useCapabilities } from "../use-capabilities.js";

/**
 * What this Studio session can do right now: local editing (always available; it writes only
 * your own project files behind the loopback session), whether provider-calling actions were
 * enabled at startup with --allow-spend, and whether the live-refresh stream is currently up.
 */
function SessionSection(): ReactNode {
  const capabilitiesState = useCapabilities();
  const [connection, setConnection] = useState(connectionStore.getStatus());
  useEffect(() => connectionStore.subscribe(setConnection), []);

  const spend =
    capabilitiesState.kind === "loaded" ? capabilitiesState.capabilities.spend : undefined;

  const items: Array<readonly [string, ReactNode]> = [
    [
      "Local editing",
      <Badge key="editing" tone="success">
        Available
      </Badge>,
    ],
    [
      "Provider actions",
      spend === undefined ? (
        <span key="spend" className="text-sm text-muted-foreground">
          Loading…
        </span>
      ) : (
        <Badge key="spend" tone={spend ? "success" : "neutral"}>
          {spend ? "Enabled" : "Off (start with --allow-spend)"}
        </Badge>
      ),
    ],
    [
      "Live updates",
      <Badge key="live" tone={connection === "live" ? "success" : "warning"}>
        {connection === "live" ? "Connected" : "Reconnecting"}
      </Badge>,
    ],
  ];

  return (
    <SectionCard
      title="Session"
      intro="What this Studio process can do, resolved once at startup."
      className="mb-6"
    >
      <DetailList items={items} />
    </SectionCard>
  );
}

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

type SettingsState =
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
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {terms.map(([term, translation]) => (
        <li key={term} className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <span className="font-mono text-sm font-semibold text-accent-foreground">{term}</span>
          {/* The glossary has no per-entry locale (it is one project-wide term map, see
              sdk's VerbatraConfig.glossary), so which locale's script a preferred term is
              written in cannot be known here. dir="auto" lets the browser infer direction
              from the value's own first strong character instead of guessing a locale. */}
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
 * The settings overview: what this session can do (capabilities and the live-update stream),
 * the resolved config snapshot (project.snapshot), and the glossary (glossary.get). The config
 * and glossary are independent, stateless reads made fresh on every mount; nothing here changes
 * day to day, which is why this lives in the sidebar's reference zone.
 */
export function SettingsPanel(): ReactNode {
  return (
    <>
      <PageHeader
        kicker="Project configuration"
        title="Settings"
        description="This session's capabilities, and the resolved configuration and glossary it was started with."
      />
      <SessionSection />
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
