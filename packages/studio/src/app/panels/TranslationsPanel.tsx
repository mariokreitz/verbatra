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
import { Accordion, AccordionItem } from "../Accordion.js";
import { diffDataStore, openKeyStore, rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { Button } from "../Button.js";
import { Card } from "../Card.js";
import type { DiffTone } from "../DiffBadge.js";
import { DiffBadge } from "../DiffBadge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Icon } from "../Icon.js";
import { SearchInput } from "../Input.js";
import { KeyDetailDrawer } from "../KeyDetailDrawer.js";
import { Loading } from "../Loading.js";
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

type DiffViewMode = "grid" | "flat";

type DiffState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: StructuredError }
  | {
      readonly kind: "loaded";
      readonly hasPendingChanges: boolean;
      readonly locales: readonly DiffLocale[];
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

/** Lock-file existence, version, and per-locale drift via `lock.state`, fetched once per mount
 * (unchanged from the standalone Lock page this section absorbed). */
function useLockState(): LockView {
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
  }, []);

  return view;
}

/** How long the "Copied" confirmation stays visible after a successful clipboard write. */
const COPY_CONFIRMATION_MS = 2000;

/**
 * The page's contextual action, rendered in the `PageHeader`: it renders the panel's full,
 * currently loaded diff data (never the on-screen filtered or capped view) as a Markdown review
 * report and copies it to the clipboard. The confirmation is a transient label swap, not a new
 * toast system, matching this codebase's existing preference for small, direct feedback.
 * Clipboard access can fail (an insecure context, or a browser permission denial); there is
 * nothing actionable to surface beyond the button simply not confirming.
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
    } catch {
      // No actionable detail to show; the button simply does not confirm.
    }
  }

  return (
    <Button size="md" onClick={() => void handleClick()}>
      <Icon name={copied ? "check" : "copy"} size={14} />
      {copied ? "Copied" : "Copy as review report"}
    </Button>
  );
}

/**
 * The workspace's opening statement, replacing both the old metric-tile strip and the separate
 * all-clear banner: one asymmetric card with the headline verdict on the start side (how many
 * keys need attention, or that everything is in sync) and the compact coverage figures on the
 * end side. The headline count comes from the key diff; the coverage figures come from the
 * refresh-reactive `status.check` read, so the two halves can resolve independently.
 */
function StatusBanner({
  status,
  diff,
}: {
  readonly status: RefreshableView<StatusData>;
  readonly diff: DiffState;
}): ReactNode {
  const allClear = diff.kind === "loaded" && isFullyInSync(diff.locales);
  const rows = status.kind === "data" ? status.data.rows : null;

  return (
    <Card className={cnBanner(allClear)} {...(allClear ? { role: "status" } : {})}>
      <div className="min-w-0 max-w-xl">
        <BannerHeadline diff={diff} allClear={allClear} rows={rows} />
      </div>
      {rows !== null ? (
        <div className="flex w-full flex-none flex-col gap-3 sm:w-56">
          <div>
            <p className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
              Average coverage
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {averageCoverage(rows)}%
              </span>
            </p>
            <ProgressBar percent={averageCoverage(rows)} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {rows.length} target {rows.length === 1 ? "locale" : "locales"}
            <Badge tone={status.kind === "data" && status.data.inSync ? "success" : "warning"}>
              {status.kind === "data" && status.data.inSync ? "In sync" : "Out of sync"}
            </Badge>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function cnBanner(allClear: boolean): string {
  const base = "mb-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-4";
  return allClear ? `${base} border-s-[3px] border-s-success` : base;
}

function BannerHeadline({
  diff,
  allClear,
  rows,
}: {
  readonly diff: DiffState;
  readonly allClear: boolean;
  readonly rows: readonly StatusRow[] | null;
}): ReactNode {
  if (diff.kind === "loading") {
    return (
      <>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </>
    );
  }
  if (diff.kind === "error") {
    return (
      <>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          Sync state unavailable
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          The pending-change check failed; details below.
        </p>
      </>
    );
  }
  if (allClear) {
    return (
      <>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          Everything&apos;s in sync
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          No missing, changed, or orphaned keys in any configured locale.
        </p>
      </>
    );
  }
  const pending = driftKeys(diff.locales).length;
  return (
    <>
      <p className="text-2xl font-semibold tracking-tight text-foreground">
        {pending} {pending === 1 ? "key needs" : "keys need"} attention
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {rows !== null
          ? `Across ${outOfSyncCount(rows)} of ${rows.length} target ${rows.length === 1 ? "locale" : "locales"}.`
          : "Across your target locales."}
      </p>
    </>
  );
}

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
 * One locale's missing/changed/orphaned key lists, collapsed by default when that locale is
 * already up to date and expanded by default when it has pending changes: a project with many
 * target locales does not present as a wall of open sections, only the ones that need attention
 * do. Built on `AccordionItem` (native `<details>`/`<summary>`), so a reader can still expand a
 * synced locale manually; nothing here is ever hidden outright.
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
 * The drift-affected keys, the workspace's primary surface: a key-by-locale grid (default) or
 * per-locale collapsible lists, with a filter in list mode. Rendered only while something is
 * actually pending; the fully-in-sync state is carried by the banner instead of a wall of empty
 * lists. Key selection flows through the shared `openKeyStore`, the same path the command
 * palette uses.
 */
function KeysSection({
  locales,
  hasPendingChanges,
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
}: {
  readonly locales: readonly DiffLocale[];
  readonly hasPendingChanges: boolean;
  readonly query: string;
  readonly onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly viewMode: DiffViewMode;
  readonly onViewModeChange: (mode: DiffViewMode) => void;
}): ReactNode {
  return (
    <PageSection
      title="Keys"
      meta={
        <Badge tone={hasPendingChanges ? "warning" : "success"}>
          {hasPendingChanges ? "Pending changes" : "Up to date"}
        </Badge>
      }
    >
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
        <StatusGrid locales={locales} onSelectKey={openKeyStore.request} />
      ) : (
        <Accordion>
          {locales.map((locale) => (
            <LocaleSection
              key={locale.locale}
              locale={locale}
              query={query}
              onSelectKey={openKeyStore.request}
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
  return (
    <TableRow>
      <TableCell mono>{row.locale}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <ProgressBar percent={row.percent} className="w-24 flex-none" />
          <span className="tabular-nums text-muted-foreground">{row.percent}%</span>
        </span>
      </TableCell>
      <TableCell numeric>{row.missing}</TableCell>
      <TableCell numeric>{row.stale}</TableCell>
      <TableCell numeric>{row.upToDate}</TableCell>
      <TableCell>
        <Badge tone={row.inSync ? "success" : "warning"}>
          {row.inSync ? "In sync" : "Out of sync"}
        </Badge>
      </TableCell>
      {lock.kind === "loaded" ? <TableCell>{lockCell(lock, row.locale)}</TableCell> : null}
    </TableRow>
  );
}

/** The lock file's own record, behind a collapsed disclosure: keys per recorded locale and
 * drift measured against the current files (its counts are lock-vs-files, deliberately not
 * conflated with the source-vs-targets counts in the coverage table above). */
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
              <TableHeaderCell>State</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {locales.map((locale) => {
              const drift = locale.missing > 0 || locale.stale > 0;
              return (
                <TableRow key={locale.locale}>
                  <TableCell mono>{locale.locale}</TableCell>
                  <TableCell numeric>{locale.keyCount}</TableCell>
                  <TableCell numeric>{locale.missing}</TableCell>
                  <TableCell numeric>{locale.stale}</TableCell>
                  <TableCell numeric>{locale.upToDate}</TableCell>
                  <TableCell>
                    <Badge tone={drift ? "warning" : "success"}>
                      {drift ? "Drift" : "In sync"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AccordionItem>
  );
}

/**
 * Per-locale coverage (the refresh-reactive `status.check` read, with its keep-last-good-data
 * behavior via `client/state.ts`) merged with the lock file's presence: one table answers "how
 * far along is each locale, and does its lock entry agree", where these used to be two separate
 * pages showing near-identical rows.
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
                  <TableHeaderCell>State</TableHeaderCell>
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
 * The daily workspace: everything the old Status, Diff, and Lock pages showed, on one scroll.
 * Three independent reads compose it, keeping each one's original semantics:
 *
 * - `status.check` (coverage) via {@link useStatusData}, re-fetched on every live-refresh event,
 *   with the covered keep-last-good-data reducer and its stale banner.
 * - `status.diff` (the key lists), fetched once per mount and deliberately NOT re-fetched on
 *   live refresh (unchanged scope choice from the standalone Diff page). It feeds the shared
 *   `diffDataStore` for the command palette and drives the banner headline and the key explorer.
 * - `lock.state`, fetched once per mount.
 *
 * The selected key and the loaded diff data flow through the module-level stores
 * (`client/diff-session.ts`, wired in `app/api.ts`): the palette, a sibling of this panel, reads
 * the same data and requests the same drawer-open a manual click performs, with no second RPC
 * call. The open-key request clears on unmount and on manual close, so leaving this page never
 * leaves a stale request behind. `refreshToken` passes through to the open drawer, whose
 * `key.integrity` view re-fetches on live refresh.
 */
export function TranslationsPanel({ refreshToken }: PanelProps): ReactNode {
  const [diff, setDiff] = useState<DiffState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(openKeyStore.getState());
  const [viewMode, setViewMode] = useState<DiffViewMode>("grid");
  const status = useStatusData(refreshToken);
  const lock = useLockState();

  useEffect(() => openKeyStore.subscribe(setSelectedKey), []);
  useEffect(() => () => openKeyStore.clear(), []);

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("status.diff", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setDiff({ kind: "error", error: response.error });
        return;
      }
      diffDataStore.setLocales(response.result.locales);
      setDiff({
        kind: "loaded",
        hasPendingChanges: response.result.hasPendingChanges,
        locales: response.result.locales,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allClear = diff.kind === "loaded" && isFullyInSync(diff.locales);

  return (
    <>
      <PageHeader
        title="Translations"
        description="Every pending change across your target locales, and how far along each locale is."
        actions={diff.kind === "loaded" ? <ReviewReportButton locales={diff.locales} /> : undefined}
      />
      <StatusBanner status={status} diff={diff} />
      {diff.kind === "loading" ? <Loading /> : null}
      {diff.kind === "error" ? <ErrorMessage error={diff.error} /> : null}
      {diff.kind === "loaded" && !allClear ? (
        <KeysSection
          locales={diff.locales}
          hasPendingChanges={diff.hasPendingChanges}
          query={query}
          onQueryChange={(event) => setQuery(event.target.value)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : null}
      <LocalesSection status={status} lock={lock} />
      {selectedKey !== null && diff.kind === "loaded" ? (
        <KeyDetailDrawer
          keyName={selectedKey}
          locales={diff.locales}
          refreshToken={refreshToken}
          onClose={() => openKeyStore.clear()}
        />
      ) : null}
    </>
  );
}
