import type { CSSProperties } from "react";

/**
 * The 56px graph-paper background shared by every grid-pattern backdrop. Callers
 * layer their own `opacity` and mask on top, since those vary per site.
 */
export const GRID_PATTERN_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)",
  backgroundSize: "56px 56px",
};
