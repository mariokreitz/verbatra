import type { ReactNode } from "react";
import { Button } from "./Button.js";

/**
 * The Edit, Approve, and Reject buttons for one review row. Purely
 * presentational: each button calls the matching callback and nothing here
 * issues an RPC call or holds state.
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
    <span className="ms-2 inline-flex items-center gap-2">
      <Button onClick={onEdit}>Edit</Button>
      <Button className="text-success" onClick={onApprove}>
        Approve
      </Button>
      <Button className="text-danger" onClick={onReject}>
        Reject
      </Button>
    </span>
  );
}
