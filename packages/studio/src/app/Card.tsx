import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/cn.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly padding?: "none" | "sm" | "md";
  readonly as?: "div" | "section";
}

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
