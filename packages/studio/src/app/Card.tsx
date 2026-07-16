import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/cn.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "none" is for flush content that brings its own spacing, most notably `TableCard`'s
   * edge-to-edge tables. */
  readonly padding?: "none" | "sm" | "md";
  /** The element `Card` renders as. Defaults to a plain `div`; `section` is for a caller that is
   * itself a landmark with its own heading, not a general-purpose polymorphism escape hatch. No
   * current caller needs it (the Diff panel's per-locale groups, the original reason this existed,
   * moved onto `AccordionItem`); kept for the next `Card`-shaped landmark rather than removed. */
  readonly as?: "div" | "section";
}

/**
 * A bordered-surface container: metric tiles, section cards, and the `Toast` shell
 * `RefreshToast` builds on. `Sheet`'s own panel uses the same visual tokens (`rounded-lg border
 * border-border bg-card`) directly rather than through this component, since its layout (fixed
 * positioning, `role="dialog"`, a focus-trap ref) doesn't fit `Card`'s plain div/section shape. `padding` covers the two sizes those callers actually need; add a new one
 * only when a real usage needs it. Forwards the rest of the standard div attributes (`role`,
 * `aria-*`) since `Toast` needs the card itself to carry an ARIA live-region role.
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
