import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/** One pulsing placeholder block. Use directly for a single line, or compose
 * several for a content-shaped loading state such as {@link TableSkeleton}. */
export function Skeleton({ className }: { readonly className?: string }): ReactNode {
  return (
    <span className={cn("block animate-pulse rounded-md bg-muted", className)} aria-hidden="true" />
  );
}

/**
 * A table-shaped loading placeholder: a header-row bar plus `rows` body-row
 * bars. Not `role="status"` itself; the caller wraps it in one live region so
 * the loading announcement fires once, not once per bar.
 */
export function TableSkeleton({ rows = 4 }: { readonly rows?: number }): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}
