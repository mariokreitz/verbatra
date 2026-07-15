import type { ReactNode } from "react";
import type { DiffLocale, KeyLocaleStatusRow } from "../client/diff-view.js";
import { deriveKeyLocaleStatus } from "../client/diff-view.js";
import { deriveIntegrityPillView, type KeyIntegrityLocaleEntry } from "../client/integrity-pill.js";
import { isRtlLocale } from "../client/locale-direction.js";
import { canRetranslate } from "../client/retranslate-eligibility.js";
import type { StudioCapabilities } from "../shared/rpc/snapshot.js";
import { Badge } from "./Badge.js";
import { CommitList } from "./CommitList.js";
import { DiffBadge } from "./DiffBadge.js";
import { RetranslateButton } from "./RetranslateButton.js";
import { useCapabilities } from "./use-capabilities.js";
import { useDialogA11y } from "./use-dialog-a11y.js";
import { useHistoryList } from "./use-history-list.js";
import { useKeyIntegrity } from "./use-key-integrity.js";

export interface KeyDetailDrawerProps {
  /** The key this drawer reports on. */
  readonly keyName: string;
  /** The Diff panel's already-loaded per-locale diff data; never re-fetched by this component. */
  readonly locales: readonly DiffLocale[];
  /** Bumped once per live-refresh event; re-fetches this drawer's own integrity view. */
  readonly refreshToken: number;
  readonly onClose: () => void;
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

function LocaleStatusRow({
  row,
  keyName,
  integrity,
  capabilities,
}: {
  readonly row: KeyLocaleStatusRow;
  readonly keyName: string;
  readonly integrity: readonly KeyIntegrityLocaleEntry[];
  readonly capabilities: StudioCapabilities | undefined;
}): ReactNode {
  return (
    <tr dir={isRtlLocale(row.locale) ? "rtl" : undefined}>
      <td className="mono">{row.locale}</td>
      <td>
        {row.status === "in-sync" ? (
          <Badge tone="success">In sync</Badge>
        ) : (
          <DiffBadge tone={row.status} />
        )}
      </td>
      <td>
        <IntegrityCell
          integrity={integrity}
          locale={row.locale}
          keyName={keyName}
          capabilities={capabilities}
        />
      </td>
    </tr>
  );
}

/**
 * Per-key detail drawer: one key's status per locale, derived from the diff data the Diff panel
 * already loaded (never re-fetched here); the key's placeholder or ICU integrity per locale, via
 * `key.integrity`, fetched fresh whenever the drawer opens for a new key; and the project's commit
 * history for the source and target locale files via `history.list`. The history is deliberately
 * not filtered to commits that touched this specific key: `history.list` scopes `git log` to whole
 * locale files, not individual keys (see `server/methods/history.ts`), so this reports the same
 * commit history HistoryPanel shows, offered as project context rather than a false per-key
 * filter. Translation values themselves stay out of scope: they are still not available over the
 * read-only RPC surface, only the boolean integrity result and, on a mismatch, the specific
 * placeholder tokens involved.
 *
 * Focus trap, Esc-to-close, and focus restoration come from `useDialogA11y`, shared with any
 * future overlay this dashboard adds. The backdrop dismiss is a real `<button>` behind the panel
 * in both stacking order and the focus trap, not a click handler on a static element, so clicking
 * outside the panel to close stays a genuine, keyboard-operable control rather than a mouse-only
 * affordance.
 *
 * Manual RTL verification note: given a config with an RTL target locale (for example "ar"), that
 * locale's row in the status table below renders with `dir="rtl"`, right-aligning that row's cells
 * while every other row stays left-to-right; `isRtlLocale` itself is covered in
 * `client/locale-direction.test.ts`. src/app has no browser-rendered test harness in this package
 * (see vitest.config.ts), so this was verified by reading the rendered attribute logic in
 * isolation rather than in a browser.
 *
 * `refreshToken` threads the app's existing live-refresh signal into this drawer's own
 * `key.integrity` fetch (`useKeyIntegrity`): a successful retranslate writes the target file and
 * the lock, the project watcher observes that change and broadcasts the same `refresh` SSE event
 * any external edit already triggers, and this drawer re-fetches without closing and reopening.
 */
export function KeyDetailDrawer({
  keyName,
  locales,
  refreshToken,
  onClose,
}: KeyDetailDrawerProps): ReactNode {
  const history = useHistoryList();
  const integrity = useKeyIntegrity(keyName, refreshToken);
  const capabilitiesState = useCapabilities();
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  const rows = deriveKeyLocaleStatus(locales, keyName);
  const integrityLocales = integrity.kind === "loaded" ? integrity.locales : [];
  const capabilities =
    capabilitiesState.kind === "loaded" ? capabilitiesState.capabilities : undefined;

  return (
    <div className="drawer-backdrop">
      <button
        type="button"
        className="drawer-backdrop-dismiss"
        onClick={onClose}
        aria-label={`Close details for ${keyName}`}
      />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${keyName}`}
        ref={containerRef}
      >
        <div className="drawer-header">
          <h2 className="drawer-title mono">{keyName}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <section className="panel-section">
          <h3>Status by locale</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Locale</th>
                <th>Status</th>
                <th>Integrity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <LocaleStatusRow
                  row={row}
                  keyName={keyName}
                  integrity={integrityLocales}
                  capabilities={capabilities}
                  key={row.locale}
                />
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel-section">
          <h3>History</h3>
          <p className="panel-intro">
            Commit history for this project's locale files, not filtered to this key.
          </p>
          <CommitList
            state={history}
            emptyClassName="empty-state-inline"
            emptyMessage="No commit history yet for the locale files."
          />
        </section>
      </div>
    </div>
  );
}
