import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/**
 * A small hover/focus label for icon-only controls (the collapsed sidebar rail, compact icon
 * buttons). CSS-only: shown via group-hover and group-focus-within, no positioning script and no
 * open state to manage. The bubble is `aria-hidden` by design, which makes one demand of every
 * caller: the wrapped control must already carry its own accessible name (an `aria-label` or
 * visible text), so the tooltip is purely a sighted-user duplicate of it, never the only name.
 */
export function Tooltip({
  label,
  side = "end",
  children,
}: {
  readonly label: string;
  /** Where the bubble sits relative to the control: "end" (inline-end, the sidebar rail case)
   * or "bottom" (below, for top-bar controls). */
  readonly side?: "end" | "bottom";
  readonly children: ReactNode;
}): ReactNode {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute z-40 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-foreground opacity-0 shadow-panel transition-opacity delay-150",
          "group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          side === "end"
            ? "start-full top-1/2 ms-2 -translate-y-1/2"
            : "start-1/2 top-full mt-2 -translate-x-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
