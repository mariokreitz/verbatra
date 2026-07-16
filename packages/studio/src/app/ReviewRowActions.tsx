import type { ReactNode } from "react";

/**
 * Approve, Edit, and Reject for one flagged row. Approve and Reject are purely client-side
 * dismissals with identical mechanics (mark this `(locale, key)` pair actioned in the session
 * overlay) differing only in label and visual tone, per structural ruling 2: neither ever issues
 * an RPC call. Edit opens {@link EditEntryDialog}, the only action of the three that reaches the
 * server. The caller renders this component at all only when `capabilities.writeToDisk` is true
 * (see `ReviewPanel`), so the whole row is absent from the DOM, not merely disabled, when write
 * capability is off.
 */
export function ReviewRowActions({
  onApprove,
  onReject,
  onEdit,
}: {
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly onEdit: () => void;
}): ReactNode {
  return (
    <span className="retranslate-action">
      <button type="button" className="retranslate-button" onClick={onEdit}>
        Edit
      </button>
      <button
        type="button"
        className="retranslate-button retranslate-status-success"
        onClick={onApprove}
      >
        Approve
      </button>
      <button type="button" className="retranslate-button" onClick={onReject}>
        Reject
      </button>
    </span>
  );
}
