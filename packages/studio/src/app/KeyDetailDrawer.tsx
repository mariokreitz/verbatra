import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { DiffLocale, KeyLocaleStatusRow } from "../client/diff-view.js";
import { deriveKeyLocaleStatus } from "../client/diff-view.js";
import { deriveIntegrityPillView, type KeyIntegrityLocaleEntry } from "../client/integrity-pill.js";
import { isRtlLocale } from "../client/locale-direction.js";
import { canRetranslate } from "../client/retranslate-eligibility.js";
import type { StudioCapabilities } from "../shared/rpc/snapshot.js";
import { rpcClient } from "./api.js";
import { Badge } from "./Badge.js";
import { CommitList } from "./CommitList.js";
import { DiffBadge } from "./DiffBadge.js";
import { RetranslateButton } from "./RetranslateButton.js";
import { DrawerShell, Section } from "./ui.js";
import { useCapabilities } from "./use-capabilities.js";
import { useDialogA11y } from "./use-dialog-a11y.js";
import { useHistoryList } from "./use-history-list.js";
import { useKeyIntegrity } from "./use-key-integrity.js";

export interface KeyDetailDrawerProps {
  /** The key this drawer reports on. */
  readonly keyName: string;
  /** The Translations page's already-loaded per-locale diff data; never re-fetched by this component. */
  readonly locales: readonly DiffLocale[];
  /** Bumped once per live-refresh event; re-fetches this drawer's own integrity and value views. */
  readonly refreshToken: number;
  readonly onClose: () => void;
}

type KeyValuesState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "loaded";
      readonly source: string | undefined;
      readonly targets: ReadonlyMap<string, string | undefined>;
    };

/**
 * The key's current values, one `key.value` read per locale (each call is one local file read;
 * no bulk content endpoint exists, see the rpc contract's own scoping note). A locale whose read
 * fails is simply absent from the map: the drawer's status rows never depend on this fetch, so
 * a partial result degrades to fewer value lines, never an error wall. Re-fetched on every
 * live-refresh event, so an edit or retranslate shows its new value here without reopening.
 */
function useKeyValues(
  keyName: string,
  locales: readonly string[],
  refreshToken: number,
): KeyValuesState {
  const [state, setState] = useState<KeyValuesState>({ kind: "loading" });
  const localesKey = locales.join(" ");

  useEffect(() => {
    let cancelled = false;
    const localeList = localesKey === "" ? [] : localesKey.split(" ");
    void Promise.all(
      localeList.map((locale) => rpcClient.call("key.value", { locale, key: keyName })),
    ).then((responses) => {
      if (cancelled) {
        return;
      }
      let source: string | undefined;
      const targets = new Map<string, string | undefined>();
      responses.forEach((response, index) => {
        const locale = localeList[index];
        if (locale === undefined || !response.ok) {
          return;
        }
        source ??= response.result.source;
        targets.set(locale, response.result.target);
      });
      setState({ kind: "loaded", source, targets });
    });
    return () => {
      cancelled = true;
    };
  }, [keyName, localesKey, refreshToken]);

  return state;
}

/** One locale's current value line, rendered in that locale's own direction. */
function LocaleValue({
  values,
  locale,
}: {
  readonly values: KeyValuesState;
  readonly locale: string;
}): ReactNode {
  if (values.kind !== "loaded" || !values.targets.has(locale)) {
    return null;
  }
  const value = values.targets.get(locale);
  if (value === undefined) {
    return <p className="m-0 mt-2 text-sm text-muted-foreground">No translation yet.</p>;
  }
  return (
    <p className="m-0 mt-2 break-words font-mono text-sm text-foreground" dir="auto">
      {value}
    </p>
  );
}

/**
 * The placeholder or ICU integrity pill for one locale row, or nothing when the key is not
 * "changed" in that locale (no integrity check applies) or the result has not loaded yet. Renders
 * the Retranslate action alongside the pill only when `canRetranslate` says both write
 * capabilities are granted and this row currently fails integrity; otherwise the action is absent
 * entirely, not merely disabled.
 */
function IntegrityCell({
  integrity,
  locale,
  keyName,
  capabilities,
}: {
  readonly integrity: readonly KeyIntegrityLocaleEntry[];
  readonly locale: string;
  readonly keyName: string;
  readonly capabilities: StudioCapabilities | undefined;
}): ReactNode {
  const pill = deriveIntegrityPillView(integrity, locale);
  if (pill === null) {
    return null;
  }
  return (
    <>
      <Badge tone={pill.tone}>
        {pill.label}
        {pill.detail !== null ? `: ${pill.detail}` : ""}
      </Badge>
      {canRetranslate(capabilities, pill) ? (
        <RetranslateButton locale={locale} keyName={keyName} />
      ) : null}
    </>
  );
}

/**
 * One locale's block: the locale code and its status/integrity signals on the header line, the
 * current translation value under it. A stacked list rather than a table: the drawer column is
 * narrow, and real values need the full line width to stay readable.
 */
function LocaleBlock({
  row,
  keyName,
  integrity,
  capabilities,
  values,
}: {
  readonly row: KeyLocaleStatusRow;
  readonly keyName: string;
  readonly integrity: readonly KeyIntegrityLocaleEntry[];
  readonly capabilities: StudioCapabilities | undefined;
  readonly values: KeyValuesState;
}): ReactNode {
  return (
    <li
      className="border-b border-border py-3 last:border-b-0"
      dir={isRtlLocale(row.locale) ? "rtl" : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">{row.locale}</span>
        {row.status === "in-sync" ? (
          <Badge tone="success">In sync</Badge>
        ) : (
          <DiffBadge tone={row.status} />
        )}
        <IntegrityCell
          integrity={integrity}
          locale={row.locale}
          keyName={keyName}
          capabilities={capabilities}
        />
      </div>
      <LocaleValue values={values} locale={row.locale} />
    </li>
  );
}

/**
 * Per-key detail drawer: one key's status, integrity, and current value per locale, plus the
 * project's commit history. The status rows derive from the diff data the Translations page
 * already loaded (never re-fetched here); the placeholder or ICU integrity comes from
 * `key.integrity`, and the actual source and per-locale values from one `key.value` read per
 * locale, both fetched fresh whenever the drawer opens for a new key and on every live-refresh
 * event (`refreshToken`), so a successful edit or retranslate is visible here without closing
 * and reopening. The history is deliberately not filtered to this key: `history.list` scopes
 * `git log` to whole locale files (see `server/methods/history.ts`), so this reports project
 * context rather than a false per-key filter.
 *
 * Focus trap, Esc-to-close, and focus restoration come from `useDialogA11y`. The backdrop
 * dismiss is a real `<button>` behind the panel in both stacking order and the focus trap, not
 * a click handler on a static element, so clicking outside the panel to close stays a genuine,
 * keyboard-operable control. RTL locales render their block (header line and value) in their
 * own direction via `dir`, and values additionally use `dir="auto"` so a value's own first
 * strong character decides its direction.
 */
export function KeyDetailDrawer({
  keyName,
  locales,
  refreshToken,
  onClose,
}: KeyDetailDrawerProps): ReactNode {
  const history = useHistoryList(refreshToken);
  const integrity = useKeyIntegrity(keyName, refreshToken);
  const capabilitiesState = useCapabilities();
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  const rows = deriveKeyLocaleStatus(locales, keyName);
  const values = useKeyValues(
    keyName,
    rows.map((row) => row.locale),
    refreshToken,
  );
  const integrityLocales = integrity.kind === "loaded" ? integrity.locales : [];
  const capabilities =
    capabilitiesState.kind === "loaded" ? capabilitiesState.capabilities : undefined;

  return (
    <DrawerShell
      title={keyName}
      ariaLabel={`Details for ${keyName}`}
      closeLabel={`Close details for ${keyName}`}
      onClose={onClose}
      containerRef={containerRef}
    >
      <Section title="Source">
        {values.kind === "loaded" && values.source !== undefined ? (
          <p className="m-0 break-words font-mono text-sm text-foreground" dir="auto">
            {values.source}
          </p>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            {values.kind === "loading" ? "Loading value…" : "No current source value."}
          </p>
        )}
      </Section>
      <Section title="Locales">
        <ul className="m-0 list-none p-0">
          {rows.map((row) => (
            <LocaleBlock
              row={row}
              keyName={keyName}
              integrity={integrityLocales}
              capabilities={capabilities}
              values={values}
              key={row.locale}
            />
          ))}
        </ul>
      </Section>
      <Section
        title="History"
        intro="Commit history for this project's locale files, not filtered to this key."
      >
        <CommitList
          state={history}
          compact
          emptyMessage="No commit history yet for the locale files."
        />
      </Section>
    </DrawerShell>
  );
}
