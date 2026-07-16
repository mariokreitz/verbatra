import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/**
 * A thin horizontal meter for a 0-100 percentage: locale coverage, budget consumption. Decorative
 * by default (`aria-hidden`), for the common case where the number it visualizes is already
 * printed right next to it; pass `ariaLabel` only when the bar is the sole carrier of the value,
 * which also switches it to a real `role="progressbar"` with the value wired up.
 */
export function ProgressBar({
  percent,
  tone = "primary",
  ariaLabel,
  className,
}: {
  /** Clamped to 0-100 before rendering; callers pass whatever their data source reports. */
  readonly percent: number;
  /** "danger" for an exhausted budget or an alarming level; "primary" otherwise. */
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
