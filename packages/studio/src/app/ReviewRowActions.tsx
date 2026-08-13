import type { ReactNode } from "react";
import { Button } from "./Button.js";

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
