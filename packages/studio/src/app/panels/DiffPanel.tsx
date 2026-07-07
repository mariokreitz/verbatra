import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { filterAndCapKeys, MAX_RENDERED_KEYS } from "../../client/filter.js";
import type { RpcCallResult } from "../../client/rpc-client.js";
import { rpcClient } from "../api.js";
import { Badge } from "../Badge.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";

type DiffResponse = RpcCallResult<"status.diff">;
type DiffLocale = Extract<DiffResponse, { ok: true }>["result"]["locales"][number];

type DiffPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "loaded";
      readonly hasPendingChanges: boolean;
      readonly locales: readonly DiffLocale[];
    };

function KeyList({
  title,
  keys,
  query,
}: {
  readonly title: string;
  readonly keys: readonly string[];
  readonly query: string;
}): ReactNode {
  const capped = filterAndCapKeys(keys, query);
  return (
    <div className="key-list">
      <h4>
        {title} ({capped.totalMatches})
      </h4>
      <ul>
        {capped.items.map((key) => (
          <li key={key}>{key}</li>
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
}: {
  readonly locale: DiffLocale;
  readonly query: string;
}): ReactNode {
  return (
    <section className="locale-section">
      <h3 className="locale-section-heading">
        {locale.locale}
        {locale.hasPendingChanges ? (
          <Badge tone="warning">Pending changes</Badge>
        ) : (
          <span className="empty-state-inline">Up to date</span>
        )}
      </h3>
      <KeyList title="Missing" keys={locale.missing} query={query} />
      <KeyList title="Changed" keys={locale.changed} query={query} />
      <KeyList title="Orphaned" keys={locale.orphaned} query={query} />
    </section>
  );
}

/**
 * Key-level pending-change explorer, from the sdk's read-only `diff` through `status.diff`. Always
 * requests every configured target locale (never sends an empty `locales` array); the filter
 * input narrows the three key lists per locale on the client, capped at {@link MAX_RENDERED_KEYS}
 * items each.
 */
export function DiffPanel(): ReactNode {
  const [state, setState] = useState<DiffPanelState>({ kind: "loading" });
  const [query, setQuery] = useState("");

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

  return (
    <div>
      <p className="panel-intro">
        Overall:{" "}
        <Badge tone={state.hasPendingChanges ? "warning" : "success"}>
          {state.hasPendingChanges ? "Pending changes" : "Up to date"}
        </Badge>
      </p>
      <label className="filter-label">
        Filter keys
        <input className="filter-input" value={query} onChange={onQueryChange} />
      </label>
      {state.locales.map((locale) => (
        <LocaleSection key={locale.locale} locale={locale} query={query} />
      ))}
    </div>
  );
}
