import type { ReactNode } from "react";
import type { DiffLocale, KeyLocaleStatusRow } from "../client/diff-view.js";
import { deriveKeyLocaleStatus } from "../client/diff-view.js";
import { isRtlLocale } from "../client/locale-direction.js";
import { Badge } from "./Badge.js";
import { CommitList } from "./CommitList.js";
import { DiffBadge } from "./DiffBadge.js";
import { useDialogA11y } from "./use-dialog-a11y.js";
import { useHistoryList } from "./use-history-list.js";

export interface KeyDetailDrawerProps {
  /** The key this drawer reports on. */
  readonly keyName: string;
  /** The Diff panel's already-loaded per-locale diff data; never re-fetched by this component. */
  readonly locales: readonly DiffLocale[];
  readonly onClose: () => void;
}

function LocaleStatusRow({ row }: { readonly row: KeyLocaleStatusRow }): ReactNode {
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
    </tr>
  );
}

/**
 * Per-key detail drawer: one key's status per locale, derived from the diff data the Diff panel
 * already loaded (never re-fetched here), plus the project's commit history for the source and
 * target locale files via `history.list`. The history is deliberately not filtered to commits
 * that touched this specific key: `history.list` scopes `git log` to whole locale files, not
 * individual keys (see `server/methods/history.ts`), so this reports the same commit history
 * HistoryPanel shows, offered as project context rather than a false per-key filter. Translation
 * values and placeholder or ICU integrity are out of scope: neither is available over the current
 * read-only RPC surface.
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
 */
export function KeyDetailDrawer({ keyName, locales, onClose }: KeyDetailDrawerProps): ReactNode {
  const history = useHistoryList();
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  const rows = deriveKeyLocaleStatus(locales, keyName);

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
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <LocaleStatusRow row={row} key={row.locale} />
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
