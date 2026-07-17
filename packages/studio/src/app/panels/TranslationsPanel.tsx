import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  averageCoverage,
  outOfSyncCount,
  type StatusData,
  type StatusRow,
} from "../../client/coverage.js";
import type { DiffLocale } from "../../client/diff-view.js";
import { driftKeys, isFullyInSync } from "../../client/diff-view.js";
import { filterAndCapKeys, MAX_RENDERED_KEYS } from "../../client/filter.js";
import { isRtlLocale } from "../../client/locale-direction.js";
import { buildReviewReportMarkdown } from "../../client/review-report.js";
import type { RpcCallResult } from "../../client/rpc-client.js";
import type { RefreshableView, StructuredError } from "../../client/state.js";
import { toUsageTickerDisplayState } from "../../client/usage-ticker-data.js";
import { Accordion, AccordionItem } from "../Accordion.js";
import { reviewOverlayStore, rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { Button } from "../Button.js";
import { Card } from "../Card.js";
import type { DiffTone } from "../DiffBadge.js";
import { DiffBadge } from "../DiffBadge.js";
import { EditEntryDialog } from "../EditEntryDialog.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Icon } from "../Icon.js";
import { SearchInput } from "../Input.js";
import { KeyDetailDrawer } from "../KeyDetailDrawer.js";
import { Loading } from "../Loading.js";
import { MetricCard } from "../MetricCard.js";
import { PageHeader } from "../PageHeader.js";
import { ProgressBar } from "../ProgressBar.js";
import type { PanelProps } from "../panel-props.js";
import { Skeleton, TableSkeleton } from "../Skeleton.js";
import { StatusGrid } from "../StatusGrid.js";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../Table.js";
import { Tabs } from "../Tabs.js";
import { Toolbar } from "../Toolbar.js";
import { PageSection } from "../ui.js";
import { useStatusData } from "../use-status-data.js";
import { useUsageTicker } from "../use-usage-ticker.js";

type DiffViewMode = "grid" | "flat";

type DiffState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: StructuredError }
  | {
      readonly kind: "loaded";
      readonly hasPendingChanges: boolean;
      readonly locales: readonly DiffLocale[];
      /** Set when the most recent live re-fetch failed: the data shown is the last good read. */
      readonly staleError?: StructuredError;
    };

type LockStateResponse = RpcCallResult<"lock.state">;
type LockLocaleState = Extract<
  Extract<LockStateResponse, { ok: true }>["result"],
  { exists: true }
>["locales"][number];

type LockView =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: StructuredError }
  | { readonly kind: "no-lock" }
  | {
      readonly kind: "loaded";
      readonly version: number;
      readonly locales: readonly LockLocaleState[];
    };

/** Lock-file existence, version, and per-locale drift via `lock.state`,
 * re-fetched whenever `refreshToken` changes. */
function useLockState(refreshToken: number): LockView {
  const [view, setView] = useState<LockView>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("lock.state", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setView({ kind: "error", error: response.error });
        return;
      }
      if (!response.result.exists) {
        setView({ kind: "no-lock" });
        return;
      }
      setView({
        kind: "loaded",
        version: response.result.version,
        locales: response.result.locales,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return view;
}

/** How long the "Copied" confirmation stays visible after a successful clipboard write. */
const COPY_CONFIRMATION_MS = 2000;

/**
 * The page's contextual action: renders the full, currently loaded diff data
 * (never the on-screen filtered or capped view) as a Markdown review report
 * and copies it to the clipboard. Confirmation is a transient label swap. A
 * failed clipboard write is swallowed; the button simply does not confirm.
 */
function ReviewReportButton({ locales }: { readonly locales: readonly DiffLocale[] }): ReactNode {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  async function handleClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildReviewReportMarkdown(locales));
      setCopied(true);
      timeoutRef.current = window.setTimeout(() => setCopied(false), COPY_CONFIRMATION_MS);
    } catch {}
  }

  return (
    <Button size="md" onClick={() => void handleClick()}>
      <Icon name={copied ? "check" : "copy"} size={14} />
      {copied ? "Copied" : "Copy as review report"}
    </Button>
  );
}

/** The attention tile's figure and copy for each diff state, so the strip
 * never fabricates a zero while the diff is still loading or failed. */
function attentionTile(
  diff: DiffState,
  rows: readonly StatusRow[] | null,
): {
  readonly value: string;
  readonly hint: string;
  readonly tone: "default" | "success" | "danger";
} {
  if (diff.kind === "loading") {
    return { value: "…", hint: "Checking pending changes.", tone: "default" };
  }
  if (diff.kind === "error") {
    return {
      value: "N/A",
      hint: "The pending-change check failed; details below.",
      tone: "default",
    };
  }
  if (isFullyInSync(diff.locales)) {
    return { value: "0", hint: "Everything is in sync.", tone: "success" };
  }
  const pending = driftKeys(diff.locales).length;
  const across =
    rows !== null
      ? `Across ${outOfSyncCount(rows)} of ${rows.length} target ${rows.length === 1 ? "locale" : "locales"}.`
      : "Across your target locales.";
  return { value: String(pending), hint: across, tone: "danger" };
}

/** The last-run tile's figure and copy: a one-line summary of the most
 * recent run's token usage; the Activity page carries the full breakdown. */
function lastRunTile(view: ReturnType<typeof useUsageTicker>): {
  readonly value: string;
  readonly hint: string;
} {
  if (view.kind !== "data") {
    return { value: "…", hint: "Loading the last recorded run." };
  }
  const state = toUsageTickerDisplayState(view.data);
  if (state.kind !== "available") {
    return { value: "No run yet", hint: "Run verbatra translate or watch to record one." };
  }
  const usage =
    state.usage.kind === "reported"
      ? `${state.usage.inputTokens.toLocaleString()} / ${state.usage.outputTokens.toLocaleString()}`
      : "Not reported";
  const budget =
    state.budget.kind === "tracked"
      ? state.budget.exceeded
        ? "Budget ceiling reached. "
        : "Within budget. "
      : "";
  const hintLead = state.usage.kind === "reported" ? "Tokens in / out. " : "";
  return {
    value: usage,
    hint: `${hintLead}${budget}As of ${new Date(state.generatedAt).toLocaleString()}`,
  };
}

/**
 * The page's stat strip: four tiles (keys needing attention, average
 * coverage, locales in sync, the last run's usage) plus an all-clear banner
 * when nothing is pending. The tiles resolve independently from the diff,
 * the status data, and the usage ticker rather than blocking on each other.
 */
function StatStrip({
  status,
  diff,
  refreshToken,
}: {
  readonly status: RefreshableView<StatusData>;
  readonly diff: DiffState;
  readonly refreshToken: number;
}): ReactNode {
  const usage = useUsageTicker(refreshToken);
  const allClear = diff.kind === "loaded" && isFullyInSync(diff.locales);
  const rows = status.kind === "data" ? status.data.rows : null;
  const attention = attentionTile(diff, rows);
  const lastRun = lastRunTile(usage);
  const inSyncCount = rows === null ? null : rows.filter((row) => row.inSync).length;

  return (
    <div className="mb-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Needs attention"
          icon="alert"
          value={attention.value}
          hint={attention.hint}
          tone={attention.tone}
        />
        <MetricCard
          label="Avg coverage"
          icon="gauge"
          value={rows === null ? "…" : `${averageCoverage(rows)}%`}
          {...(rows === null ? {} : { progress: averageCoverage(rows) })}
          hint={
            rows === null
              ? "Loading locale coverage."
              : `Across ${rows.length} target ${rows.length === 1 ? "locale" : "locales"}.`
          }
        />
        <MetricCard
          label="Locales in sync"
          icon="globe"
          value={inSyncCount === null || rows === null ? "…" : `${inSyncCount} / ${rows.length}`}
          hint={
            status.kind === "data"
              ? status.data.inSync
                ? "All target locales are in sync."
                : "At least one locale is out of sync."
              : "Loading sync state."
          }
        />
        <MetricCard label="Last run" icon="zap" value={lastRun.value} hint={lastRun.hint} />
      </div>
      {allClear ? (
        <Card
          role="status"
          padding="sm"
          className="mt-4 flex flex-wrap items-center gap-3 border-s-[3px] border-s-success"
        >
          <Icon name="check" size={16} className="flex-none text-success" />
          <div>
            <p className="m-0 text-sm font-semibold text-foreground">Everything is in sync</p>
            <p className="m-0 mt-0.5 text-sm text-muted-foreground">
              No missing, changed, or orphaned keys in any configured locale.
            </p>
          </div>
        </Card>
      ) : null}
      {diff.kind === "loading" ? (
        <div className="mt-4">
          <Skeleton className="h-5 w-64" />
        </div>
      ) : null}
    </div>
  );
}

/** One drift tone's key list, filtered by `query` and capped at `MAX_RENDERED_KEYS`. */
function KeyList({
  tone,
  keys,
  query,
  onSelectKey,
}: {
  readonly tone: DiffTone;
  readonly keys: readonly string[];
  readonly query: string;
  readonly onSelectKey: (key: string) => void;
}): ReactNode {
  const capped = filterAndCapKeys(keys, query);
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="mb-2 flex items-center gap-2">
        <DiffBadge tone={tone} />
        <span className="text-sm text-muted-foreground">({capped.totalMatches})</span>
      </h4>
      <ul className="m-0 list-none p-0 font-mono text-sm">
        {capped.items.map((key) => (
          <li key={key}>
            <button
              type="button"
              className="-ms-2 block w-full rounded-md px-2 py-1 text-start hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              onClick={() => onSelectKey(key)}
            >
              {key}
            </button>
          </li>
        ))}
      </ul>
      {capped.truncated ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {MAX_RENDERED_KEYS} of {capped.totalMatches}, refine the filter to see more.
        </p>
      ) : null}
    </div>
  );
}

/** The at-a-glance drift figures in a locale section's always-visible summary row. */
function LocaleSectionCounts({ locale }: { readonly locale: DiffLocale }): ReactNode {
  if (!locale.hasPendingChanges) {
    return null;
  }
  return (
    <span className="text-xs text-muted-foreground">
      {locale.missing.length} missing &middot; {locale.changed.length} changed &middot;{" "}
      {locale.orphaned.length} orphaned
    </span>
  );
}

/**
 * One locale's missing, changed, and orphaned key lists in an
 * `AccordionItem`: expanded by default when the locale has pending changes,
 * collapsed when it is up to date. A reader can still expand a synced locale
 * manually.
 */
function LocaleSection({
  locale,
  query,
  onSelectKey,
}: {
  readonly locale: DiffLocale;
  readonly query: string;
  readonly onSelectKey: (key: string) => void;
}): ReactNode {
  return (
    <AccordionItem
      defaultOpen={locale.hasPendingChanges}
      dir={isRtlLocale(locale.locale) ? "rtl" : undefined}
      summary={
        <span className="inline-flex flex-wrap items-center gap-2">
          {locale.locale}
          {locale.hasPendingChanges ? (
            <Badge tone="warning">Pending changes</Badge>
          ) : (
            <Badge tone="success">Up to date</Badge>
          )}
          <LocaleSectionCounts locale={locale} />
        </span>
      }
    >
      <KeyList tone="missing" keys={locale.missing} query={query} onSelectKey={onSelectKey} />
      <KeyList tone="changed" keys={locale.changed} query={query} onSelectKey={onSelectKey} />
      <KeyList tone="orphaned" keys={locale.orphaned} query={query} onSelectKey={onSelectKey} />
    </AccordionItem>
  );
}

const VIEW_MODE_ITEMS: ReadonlyArray<{ readonly id: DiffViewMode; readonly label: string }> = [
  { id: "grid", label: "Grid" },
  { id: "flat", label: "List" },
];

/**
 * The drift-affected keys: a key-by-locale grid (default) or per-locale
 * collapsible lists, with a key filter in list mode. The caller renders this
 * only while something is pending; the all-clear state is carried by the
 * stat strip.
 */
function KeysSection({
  locales,
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  onSelectKey,
  refreshToken,
}: {
  readonly locales: readonly DiffLocale[];
  readonly query: string;
  readonly onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly viewMode: DiffViewMode;
  readonly onViewModeChange: (mode: DiffViewMode) => void;
  readonly onSelectKey: (key: string) => void;
  readonly refreshToken: number;
}): ReactNode {
  return (
    <PageSection title="Keys">
      <Toolbar className="mb-4">
        <Tabs
          items={VIEW_MODE_ITEMS}
          active={viewMode}
          onChange={onViewModeChange}
          label="Keys view"
        />
        {viewMode === "flat" ? (
          <SearchInput
            aria-label="Filter keys"
            placeholder="Filter keys…"
            value={query}
            onChange={onQueryChange}
          />
        ) : null}
      </Toolbar>
      {viewMode === "grid" ? (
        <StatusGrid locales={locales} refreshToken={refreshToken} onSelectKey={onSelectKey} />
      ) : (
        <Accordion>
          {locales.map((locale) => (
            <LocaleSection
              key={locale.locale}
              locale={locale}
              query={query}
              onSelectKey={onSelectKey}
            />
          ))}
        </Accordion>
      )}
    </PageSection>
  );
}

/** One locale's lock cell: its recorded lock entry's drift state, or "not recorded". */
function lockCell(lock: LockView, locale: string): ReactNode {
  if (lock.kind !== "loaded") {
    return null;
  }
  const entry = lock.locales.find((candidate) => candidate.locale === locale);
  if (entry === undefined) {
    return <Badge tone="neutral">Not recorded</Badge>;
  }
  const drift = entry.missing > 0 || entry.stale > 0;
  return <Badge tone={drift ? "warning" : "success"}>{drift ? "Drift" : "In step"}</Badge>;
}

function LocaleRow({ row, lock }: { readonly row: StatusRow; readonly lock: LockView }): ReactNode {
  const total = row.missing + row.stale + row.upToDate;
  return (
    <TableRow>
      <TableCell mono className="font-semibold">
        {row.locale}
      </TableCell>
      <TableCell>
        <span className="block min-w-[160px] max-w-[240px]">
          <span className="mb-1 flex items-baseline justify-between gap-3 font-mono text-xs tabular-nums">
            <span className="font-semibold text-foreground">{row.percent}%</span>
            <span className="text-muted-foreground">
              {row.upToDate.toLocaleString()} / {total.toLocaleString()} keys
            </span>
          </span>
          <ProgressBar percent={row.percent} />
        </span>
      </TableCell>
      <TableCell numeric>{row.missing}</TableCell>
      <TableCell numeric>{row.stale}</TableCell>
      <TableCell numeric>{row.upToDate}</TableCell>
      {lock.kind === "loaded" ? <TableCell>{lockCell(lock, row.locale)}</TableCell> : null}
    </TableRow>
  );
}

/** The lock file's own record, behind a collapsed disclosure: keys per
 * recorded locale and drift measured against the current files. Its counts
 * are lock-vs-files, distinct from the coverage table's source-vs-targets
 * counts. */
function LockDetail({ locales }: { readonly locales: readonly LockLocaleState[] }): ReactNode {
  return (
    <AccordionItem
      className="mt-4"
      summary={
        <span className="inline-flex items-center gap-2">
          <Icon name="lock" size={14} className="text-muted-foreground" />
          Lock file details
        </span>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        The lock file&apos;s own record: keys per recorded locale, and drift measured against the
        current files.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Locale</TableHeaderCell>
              <TableHeaderCell numeric>Recorded keys</TableHeaderCell>
              <TableHeaderCell numeric>Missing</TableHeaderCell>
              <TableHeaderCell numeric>Stale</TableHeaderCell>
              <TableHeaderCell numeric>Up to date</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {locales.map((locale) => (
              <TableRow key={locale.locale}>
                <TableCell mono>{locale.locale}</TableCell>
                <TableCell numeric>{locale.keyCount}</TableCell>
                <TableCell numeric>{locale.missing}</TableCell>
                <TableCell numeric>{locale.stale}</TableCell>
                <TableCell numeric>{locale.upToDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AccordionItem>
  );
}

/**
 * Per-locale coverage merged with the lock file's state: one table answers
 * how far along each locale is and whether its lock entry agrees. The lock
 * column and the lock detail render only when a lock file exists.
 */
function LocalesSection({
  status,
  lock,
}: {
  readonly status: RefreshableView<StatusData>;
  readonly lock: LockView;
}): ReactNode {
  return (
    <PageSection
      title="Locales"
      meta={lock.kind === "loaded" ? <Badge tone="neutral">Lock v{lock.version}</Badge> : undefined}
    >
      {status.kind === "loading" ? (
        <div role="status">
          <span className="sr-only">Loading locale coverage…</span>
          <TableSkeleton />
        </div>
      ) : null}
      {status.kind === "error" ? <ErrorMessage error={status.error} /> : null}
      {status.kind === "data" ? (
        <>
          {status.stale && (
            <ErrorMessage error={status.error} prefix="Showing the last known status." />
          )}
          <TableCard>
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Locale</TableHeaderCell>
                  <TableHeaderCell>Coverage</TableHeaderCell>
                  <TableHeaderCell numeric>Missing</TableHeaderCell>
                  <TableHeaderCell numeric>Stale</TableHeaderCell>
                  <TableHeaderCell numeric>Up to date</TableHeaderCell>
                  {lock.kind === "loaded" ? <TableHeaderCell>Lock</TableHeaderCell> : null}
                </tr>
              </TableHead>
              <TableBody>
                {status.data.rows.map((row) => (
                  <LocaleRow key={row.locale} row={row} lock={lock} />
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </>
      ) : null}
      {lock.kind === "no-lock" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No lock file yet. It is written after the first successful translate run.
        </p>
      ) : null}
      {lock.kind === "error" ? (
        <div className="mt-3">
          <ErrorMessage error={lock.error} />
        </div>
      ) : null}
      {lock.kind === "loaded" ? <LockDetail locales={lock.locales} /> : null}
    </PageSection>
  );
}

/**
 * The Translations page. Three reads re-fetch on every live-refresh event:
 * `status.check` (coverage) via {@link useStatusData}, `status.diff` (the key
 * lists) driving the stat strip and the key explorer, and `lock.state`
 * driving the lock column and detail. A failed diff re-fetch keeps the last
 * good data on screen with a stale banner; the hard error state only shows
 * before the first successful read. Clicking a key opens
 * {@link KeyDetailDrawer} over the already-loaded diff data; choosing Edit
 * there swaps the drawer for {@link EditEntryDialog} (never stacking two
 * focus-trapping dialogs), and closing the editor returns to the drawer.
 */
export function TranslationsPanel({ refreshToken }: PanelProps): ReactNode {
  const [diff, setDiff] = useState<DiffState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DiffViewMode>("grid");
  const status = useStatusData(refreshToken);
  const lock = useLockState(refreshToken);

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("status.diff", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setDiff((previous) =>
          previous.kind === "loaded"
            ? { ...previous, staleError: response.error }
            : { kind: "error", error: response.error },
        );
        return;
      }
      setDiff({
        kind: "loaded",
        hasPendingChanges: response.result.hasPendingChanges,
        locales: response.result.locales,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const allClear = diff.kind === "loaded" && isFullyInSync(diff.locales);

  return (
    <>
      <PageHeader
        kicker="Workspace"
        title="Translations"
        description="Every pending change across your target locales, and how far along each locale is."
        actions={diff.kind === "loaded" ? <ReviewReportButton locales={diff.locales} /> : undefined}
      />
      <StatStrip status={status} diff={diff} refreshToken={refreshToken} />
      {diff.kind === "loading" ? <Loading /> : null}
      {diff.kind === "error" ? <ErrorMessage error={diff.error} /> : null}
      {diff.kind === "loaded" && diff.staleError !== undefined ? (
        <ErrorMessage error={diff.staleError} prefix="Showing the last known pending changes." />
      ) : null}
      {diff.kind === "loaded" && !allClear ? (
        <KeysSection
          locales={diff.locales}
          query={query}
          onQueryChange={(event) => setQuery(event.target.value)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSelectKey={setSelectedKey}
          refreshToken={refreshToken}
        />
      ) : null}
      <LocalesSection status={status} lock={lock} />
      {selectedKey !== null && editingLocale === null && diff.kind === "loaded" ? (
        <KeyDetailDrawer
          keyName={selectedKey}
          locales={diff.locales}
          refreshToken={refreshToken}
          onClose={() => {
            setSelectedKey(null);
            setEditingLocale(null);
          }}
          onEditLocale={setEditingLocale}
        />
      ) : null}
      {selectedKey !== null && editingLocale !== null ? (
        <EditEntryDialog
          locale={editingLocale}
          keyName={selectedKey}
          onClose={() => setEditingLocale(null)}
          onAccepted={(acceptedLocale, key) => {
            reviewOverlayStore.markActioned({ locale: acceptedLocale, key });
            setEditingLocale(null);
          }}
        />
      ) : null}
    </>
  );
}
