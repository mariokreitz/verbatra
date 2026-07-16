import type { ReactNode } from "react";

/** A small, shared loading indicator every panel uses while its first rpc call is in flight. */
export function Loading(): ReactNode {
  return (
    <p className="flex items-center gap-2 py-4 text-muted-foreground" role="status">
      <span
        className="size-3.5 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden="true"
      />
      Loading...
    </p>
  );
}
