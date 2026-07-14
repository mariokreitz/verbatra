import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { DiffLocale } from "../../client/diff-view.js";
import { isFullyInSync } from "../../client/diff-view.js";
import { filterAndCapKeys, MAX_RENDERED_KEYS } from "../../client/filter.js";
import { isRtlLocale } from "../../client/locale-direction.js";
import { rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import type { DiffTone } from "../DiffBadge.js";
import { DiffBadge } from "../DiffBadge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { KeyDetailDrawer } from "../KeyDetailDrawer.js";
import { Loading } from "../Loading.js";
import { StatusGrid } from "../StatusGrid.js";

type DiffViewMode = "grid" | "flat";

type DiffPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "loaded";
      readonly hasPendingChanges: boolean;
      readonly locales: readonly DiffLocale[];
    };

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
    <div className="key-list">
      <h4 className="key-list-heading">
        <DiffBadge tone={tone} />
        <span className="key-list-count">({capped.totalMatches})</span>
      </h4>
      <ul>
        {capped.items.map((key) => (
          <li key={key}>
            <button type="button" className="key-list-item" onClick={() => onSelectKey(key)}>
              {key}
            </button>
          </li>
        ))}
      </ul>
      {capped.truncated ? (
        <p className="key-list-note">
          Showing {MAX_RENDERED_KEYS} of {capped.totalMatches}, refine the filter to see more.
        </p>
      ) : null}
    </div>
  );
}

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
    <section className="locale-section" dir={isRtlLocale(locale.locale) ? "rtl" : undefined}>
      <h3 className="locale-section-heading">
        {locale.locale}
        {locale.hasPendingChanges ? (
          <Badge tone="warning">Pending changes</Badge>
        ) : (
          <Badge tone="success">Up to date</Badge>
        )}
      </h3>
      <KeyList tone="missing" keys={locale.missing} query={query} onSelectKey={onSelectKey} />
      <KeyList tone="changed" keys={locale.changed} query={query} onSelectKey={onSelectKey} />
      <KeyList tone="orphaned" keys={locale.orphaned} query={query} onSelectKey={onSelectKey} />
    </section>
  );
}

/**
 * The grid/list switch above the Diff panel's content. Grid is the default view (rows = keys,
 * columns = locales); the flat per-locale list stays reachable as a fallback, since it renders
 * key names as a plain scrollable list rather than a wide table, which some readers may prefer
 * when there are many target locales.
 */
function ViewToggle({
  mode,
  onChange,
}: {
  readonly mode: DiffViewMode;
  readonly onChange: (mode: DiffViewMode) => void;
}): ReactNode {
  return (
    <fieldset className="view-toggle" aria-label="Diff view">
      <button
        type="button"
        className={
          mode === "grid" ? "view-toggle-button view-toggle-button-active" : "view-toggle-button"
        }
        aria-pressed={mode === "grid"}
        onClick={() => onChange("grid")}
      >
        Grid
      </button>
      <button
        type="button"
        className={
          mode === "flat" ? "view-toggle-button view-toggle-button-active" : "view-toggle-button"
        }
        aria-pressed={mode === "flat"}
        onClick={() => onChange("flat")}
      >
        List
      </button>
    </fieldset>
  );
}

/**
 * The designed all-clear state: every checked locale has empty missing, changed, and orphaned
 * lists (see {@link isFullyInSync}, which this render is gated on, not the coarser
 * `hasPendingChanges`). Replaces what would otherwise be a wall of "(0)" key lists, one per
 * locale, with a single on-brand success message.
 */
function AllClearState(): ReactNode {
  return (
    <div className="empty-state-success" role="status">
      <span className="empty-state-success-glyph" aria-hidden="true">
        ✓
      </span>
      <div>
        <p className="empty-state-success-title">Everything&apos;s in sync</p>
        <p className="empty-state-success-body">
          No missing, changed, or orphaned keys in any configured locale.
        </p>
      </div>
    </div>
  );
}

/**
 * Key-level pending-change explorer, from the sdk's read-only `diff` through `status.diff`. Always
 * requests every configured target locale (never sends an empty `locales` array); the filter
 * input narrows the three key lists per locale on the client, capped at {@link MAX_RENDERED_KEYS}
 * items each. Selecting a key (a click on its list entry) opens {@link KeyDetailDrawer} for it,
 * reusing this panel's already-loaded locales rather than a second fetch.
 */
export function DiffPanel(): ReactNode {
  const [state, setState] = useState<DiffPanelState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DiffViewMode>("grid");

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("status.diff", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setState({ kind: "error", message: response.error.message });
        return;
      }
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

  if (state.kind === "loading") {
    return <Loading />;
  }
  if (state.kind === "error") {
    return <ErrorMessage message={state.message} />;
  }

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value);
  };

  if (isFullyInSync(state.locales)) {
    return <AllClearState />;
  }

  return (
    <div>
      <p className="panel-intro">
        Overall:{" "}
        <Badge tone={state.hasPendingChanges ? "warning" : "success"}>
          {state.hasPendingChanges ? "Pending changes" : "Up to date"}
        </Badge>
      </p>
      <ViewToggle mode={viewMode} onChange={setViewMode} />
      {viewMode === "grid" ? (
        <StatusGrid locales={state.locales} onSelectKey={setSelectedKey} />
      ) : (
        <>
          <label className="filter-label">
            Filter keys
            <input className="filter-input" value={query} onChange={onQueryChange} />
          </label>
          {state.locales.map((locale) => (
            <LocaleSection
              key={locale.locale}
              locale={locale}
              query={query}
              onSelectKey={setSelectedKey}
            />
          ))}
        </>
      )}
      {selectedKey !== null ? (
        <KeyDetailDrawer
          keyName={selectedKey}
          locales={state.locales}
          onClose={() => setSelectedKey(null)}
        />
      ) : null}
    </div>
  );
}
