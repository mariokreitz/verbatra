import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/cn.js";

/** Props for {@link Card}. Extends the standard div attributes. */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inner padding. "none" is for flush content that brings its own spacing,
   * such as edge-to-edge tables. */
  readonly padding?: "none" | "sm" | "md";
  /** The element the card renders as. Defaults to a plain `div`; use `section`
   * when the card is itself a landmark with its own heading. */
  readonly as?: "div" | "section";
}

/**
 * A bordered-surface container for metric tiles, section cards, and toast
 * shells. Forwards the remaining div attributes (`role`, `aria-*`) so a caller
 * can make the card itself an ARIA live region.
 */
export function Card({
  padding = "md",
  as: Element = "div",
  className,
  ...props
}: CardProps): ReactNode {
  return (
    <Element
      className={cn(
        "rounded-lg border border-border bg-card",
        padding === "sm" && "p-4",
        padding === "md" && "p-6",
        className,
      )}
      {...props}
    />
  );
}
