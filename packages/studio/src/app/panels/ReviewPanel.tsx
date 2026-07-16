import type { ReviewReasonCode } from "@verbatra/sdk";
import type { ReactNode } from "react";
import { useState } from "react";
import type { ReviewQueueRow } from "../../client/review-queue-data.js";
import { visibleReviewQueueRows } from "../../client/review-queue-data.js";
import { reviewReasonLabel } from "../../client/review-reason-labels.js";
import type { StudioCapabilities } from "../../shared/rpc/snapshot.js";
import { reviewOverlayStore } from "../api.js";
import { Badge } from "../Badge.js";
import { EditEntryDialog } from "../EditEntryDialog.js";
import { ErrorMessage } from "../ErrorMessage.js";
import type { PanelProps } from "../panel-props.js";
import { ReviewRowActions } from "../ReviewRowActions.js";
import { TableSkeleton } from "../Skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../Table.js";
import { EmptyState } from "../ui.js";
import { useCapabilities } from "../use-capabilities.js";
import { useReviewOverlaySignal } from "../use-review-overlay-signal.js";
import { useReviewQueue } from "../use-review-queue.js";

interface EditingTarget {
  readonly locale: string;
  readonly key: string;
}

function ReasonChips({ reasons }: { readonly reasons: readonly ReviewReasonCode[] }): ReactNode {
  return (
    <>
      {reasons.map((reason) => {
        const view = reviewReasonLabel(reason);
        return (
          <Badge tone={view.tone} key={reason}>
            {view.label}
          </Badge>
        );
      })}
    </>
  );
}

function ReviewRow({
  row,
  capabilities,
  onEdit,
}: {
  readonly row: ReviewQueueRow;
  readonly capabilities: StudioCapabilities | undefined;
  readonly onEdit: (target: EditingTarget) => void;
}): ReactNode {
  return (
    <TableRow>
      <TableCell mono>{row.locale}</TableCell>
      <TableCell mono>{row.key}</TableCell>
      <TableCell>
        <ReasonChips reasons={row.reasons} />
      </TableCell>
      {capabilities?.writeToDisk === true ? (
        <TableCell>
          <ReviewRowActions
            onApprove={() => reviewOverlayStore.markActioned(row)}
            onReject={() => reviewOverlayStore.markActioned(row)}
            onEdit={() => onEdit({ locale: row.locale, key: row.key })}
          />
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function ReviewTable({
  rows,
  capabilities,
  onEdit,
}: {
  readonly rows: readonly ReviewQueueRow[];
  readonly capabilities: StudioCapabilities | undefined;
  readonly onEdit: (target: EditingTarget) => void;
}): ReactNode {
  const showActions = capabilities?.writeToDisk === true;
  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Locale</TableHeaderCell>
          <TableHeaderCell>Key</TableHeaderCell>
          <TableHeaderCell>Reasons</TableHeaderCell>
          {showActions ? <TableHeaderCell>Actions</TableHeaderCell> : null}
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <ReviewRow
            row={row}
            capabilities={capabilities}
            onEdit={onEdit}
            key={`${row.locale} ${row.key}`}
          />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The live needs-review queue: every flagged `(locale, key)` pair from the most recent CLI run's
 * persisted snapshot, with a distinct label per `ReviewReasonCode` and, when
 * `capabilities.writeToDisk` is true, an approve/edit/reject action row. The view half is
 * unconditionally available (blocked only on the persisted run-status data existing, not on any
 * capability flag); an `{ available: false }` response renders an informational empty state, never
 * an error. Approve and reject are purely client-side (see `client/review-overlay.ts`); a
 * successfully accepted edit is marked actioned the same way, so all three keep a row from
 * reappearing within the same page session, including across the live-refresh re-fetch this panel
 * already reacts to via `refreshToken`.
 */
export function ReviewPanel({ refreshToken }: PanelProps): ReactNode {
  const view = useReviewQueue(refreshToken);
  const capabilitiesState = useCapabilities();
  const capabilities =
    capabilitiesState.kind === "loaded" ? capabilitiesState.capabilities : undefined;
  useReviewOverlaySignal();
  const [editing, setEditing] = useState<EditingTarget | null>(null);

  if (view.kind === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading review queue…</span>
        <TableSkeleton />
      </div>
    );
  }
  if (view.kind === "error") {
    return <ErrorMessage error={view.error} />;
  }

  const data = view.data;
  if (!data.available) {
    return (
      <EmptyState>
        No run has been recorded yet. Run <code>verbatra translate</code> or{" "}
        <code>verbatra watch</code> to populate this queue.
      </EmptyState>
    );
  }

  const rows = visibleReviewQueueRows(data, reviewOverlayStore);

  return (
    <div>
      {view.stale && <ErrorMessage error={view.error} prefix="Showing the last known queue." />}
      {rows.length === 0 ? (
        <EmptyState>Nothing to review right now.</EmptyState>
      ) : (
        <ReviewTable rows={rows} capabilities={capabilities} onEdit={setEditing} />
      )}
      {editing !== null ? (
        <EditEntryDialog
          locale={editing.locale}
          keyName={editing.key}
          onClose={() => setEditing(null)}
          onAccepted={(locale, key) => {
            reviewOverlayStore.markActioned({ locale, key });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
