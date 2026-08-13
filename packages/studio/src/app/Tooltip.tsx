import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

export function Tooltip({
  label,
  side = "end",
  children,
}: {
  readonly label: string;
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
