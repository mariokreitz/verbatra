import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/** One pulsing placeholder block. Building block for content-shaped loading states; use directly
 * for a single line, or compose several for a table/list shape (see `TableSkeleton`). */
export function Skeleton({ className }: { readonly className?: string }): ReactNode {
  return (
    <span className={cn("block animate-pulse rounded-md bg-muted", className)} aria-hidden="true" />
  );
}

/**
 * A table-shaped loading placeholder: a header-row bar plus `rows` shorter body-row bars, for the
 * panels whose first-load state is known to be tabular (Status, Lock) rather than a generic
 * spinner. Not `role="status"` itself; the caller wraps it in one live region so the loading
 * announcement fires once, not once per bar.
 */
export function TableSkeleton({ rows = 4 }: { readonly rows?: number }): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: rows }, (_, index) => (
        // Static placeholder rows, never reordered or filtered: index is a safe, stable key.
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}
