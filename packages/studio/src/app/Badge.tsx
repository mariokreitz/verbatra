import type { ReactNode } from "react";

/** The four visual states a status pill can carry across the dashboard's panels. */
export type BadgeTone = "success" | "warning" | "neutral" | "danger";

/**
 * A small colored pill for summarizing a sync or availability state at a glance (in sync versus
 * out of sync, pending changes versus up to date, a lock's per-locale drift, history availability).
 * Purely presentational: it renders whatever text the caller passes and never derives it.
 */
export function Badge({
  tone,
  children,
}: {
  readonly tone: BadgeTone;
  readonly children: ReactNode;
}): ReactNode {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
