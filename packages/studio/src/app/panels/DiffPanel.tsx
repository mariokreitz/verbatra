import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { DiffLocale } from "../../client/diff-view.js";
import { isFullyInSync } from "../../client/diff-view.js";
import { filterAndCapKeys, MAX_RENDERED_KEYS } from "../../client/filter.js";
import { isRtlLocale } from "../../client/locale-direction.js";
import { buildReviewReportMarkdown } from "../../client/review-report.js";
import type { StructuredError } from "../../client/state.js";
import { Accordion, AccordionItem } from "../Accordion.js";
import { diffDataStore, openKeyStore, rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { Button } from "../Button.js";
import type { DiffTone } from "../DiffBadge.js";
import { DiffBadge } from "../DiffBadge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Icon } from "../Icon.js";
import { SearchInput } from "../Input.js";
import { KeyDetailDrawer } from "../KeyDetailDrawer.js";
import { Loading } from "../Loading.js";
import { PageHeader } from "../PageHeader.js";
import type { PanelProps } from "../panel-props.js";
import { StatusGrid } from "../StatusGrid.js";
import { Tabs } from "../Tabs.js";
import { Toolbar } from "../Toolbar.js";

type DiffViewMode = "grid" | "flat";

type DiffPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: StructuredError }
  | {
      readonly kind: "loaded";
      readonly hasPendingChanges: boolean;
      readonly locales: readonly DiffLocale[];
    };

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
 * The designed all-clear state: every checked locale has empty missing, changed, and orphaned
 * lists (see {@link isFullyInSync}, which this render is gated on, not the coarser
 * `hasPendingChanges`). Replaces what would otherwise be a wall of "(0)" key lists, one per
 * locale, with a single on-brand success message.
 */
function AllClearState(): ReactNode {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border-s-[3px] border-success bg-success-soft px-5 py-4 text-success"
      role="status"
    >
      <Icon name="check" className="mt-0.5 flex-none" />
      <div>
        <p className="mb-1 font-semibold text-foreground">Everything&apos;s in sync</p>
        <p className="text-sm text-muted-foreground">
          No missing, changed, or orphaned keys in any configured locale.
        </p>
      </div>
    </div>
  );
}

interface DiffContentProps {
  readonly hasPendingChanges: boolean;
  readonly locales: readonly DiffLocale[];
  readonly query: string;
  readonly onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly viewMode: DiffViewMode;
  readonly onViewModeChange: (mode: DiffViewMode) => void;
  readonly selectedKey: string | null;
  readonly refreshToken: number;
}

/** The loaded, not-fully-in-sync body: the view toolbar, the grid or the per-locale lists, and
 * the key detail drawer when a key is selected. */
function DiffContent({
  hasPendingChanges,
  locales,
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  selectedKey,
  refreshToken,
}: DiffContentProps): ReactNode {
  return (
    <div>
      <Toolbar
        end={
          <Badge tone={hasPendingChanges ? "warning" : "success"}>
            {hasPendingChanges ? "Pending changes" : "Up to date"}
          </Badge>
        }
      >
        <Tabs
          items={VIEW_MODE_ITEMS}
          active={viewMode}
          onChange={onViewModeChange}
          label="Diff view"
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
      {selectedKey !== null ? (
        <KeyDetailDrawer
          keyName={selectedKey}
          locales={locales}
          refreshToken={refreshToken}
          onClose={() => openKeyStore.clear()}
        />
      ) : null}
    </div>
  );
}

/**
 * Key-level pending-change explorer, from the sdk's read-only `diff` through `status.diff`. Always
 * requests every configured target locale (never sends an empty `locales` array); the filter
 * input narrows the three key lists per locale on the client, capped at {@link MAX_RENDERED_KEYS}
 * items each. Selecting a key (a click on its list entry, or a command palette key/locale
 * selection) opens {@link KeyDetailDrawer} for it, reusing this panel's already-loaded locales
 * rather than a second fetch.
 *
 * The selected key and the loaded locales both flow through module-level stores
 * (`client/diff-session.ts`'s `OpenKeyStore` and `DiffDataStore`, wired in `app/api.ts`) rather
 * than purely local state: the command palette lives at the app shell, a sibling of this panel,
 * and needs to read the same already-loaded diff data and request the same key-drawer open a
 * manual click here already performs, without a second RPC call. The open-key request is cleared
 * on unmount and on a manual close, so leaving the Diff tab never leaves a stale request behind
 * for a later, unrelated visit to reopen.
 *
 * `refreshToken` (from {@link PanelProps}) is passed straight through to the open drawer, so a
 * live-refresh event reaches its own `key.integrity` re-fetch; this panel's own diff data is not
 * re-fetched on every refresh (a deliberate, existing scope choice, unchanged here).
 */
export function DiffPanel({ refreshToken }: PanelProps): ReactNode {
  const [state, setState] = useState<DiffPanelState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(openKeyStore.getState());
  const [viewMode, setViewMode] = useState<DiffViewMode>("grid");

  useEffect(() => openKeyStore.subscribe(setSelectedKey), []);
  useEffect(() => () => openKeyStore.clear(), []);

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("status.diff", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setState({ kind: "error", error: response.error });
        return;
      }
      diffDataStore.setLocales(response.result.locales);
      setState({
        kind: "loaded",
        hasPendingChanges: response.result.hasPendingChanges,
        locales: response.result.locales,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value);
  };

  return (
    <>
      <PageHeader
        title="Diff"
        description="Pending changes by key across every target locale."
        actions={
          state.kind === "loaded" ? <ReviewReportButton locales={state.locales} /> : undefined
        }
      />
      {state.kind === "loading" ? <Loading /> : null}
      {state.kind === "error" ? <ErrorMessage error={state.error} /> : null}
      {state.kind === "loaded" ? (
        isFullyInSync(state.locales) ? (
          <AllClearState />
        ) : (
          <DiffContent
            hasPendingChanges={state.hasPendingChanges}
            locales={state.locales}
            query={query}
            onQueryChange={onQueryChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            selectedKey={selectedKey}
            refreshToken={refreshToken}
          />
        )
      ) : null}
    </>
  );
}
