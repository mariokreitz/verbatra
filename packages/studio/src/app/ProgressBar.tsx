import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

export function ProgressBar({
  percent,
  tone = "primary",
  ariaLabel,
  className,
}: {
  readonly percent: number;
  readonly tone?: "primary" | "danger";
  readonly ariaLabel?: string;
  readonly className?: string;
}): ReactNode {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <span
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-neutral-soft", className)}
      {...(ariaLabel === undefined
        ? { "aria-hidden": true }
        : {
            role: "progressbar",
            "aria-label": ariaLabel,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-valuenow": clamped,
          })}
    >
      <span
        className={cn(
          "block h-full rounded-[inherit] transition-[width] duration-300",
          tone === "danger" ? "bg-danger" : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </span>
  );
}
