import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/cn.js";

/** The visual emphasis of a {@link Button}: filled call-to-action, bordered default, or low-emphasis chrome. */
export type ButtonVariant = "primary" | "secondary" | "ghost";

/** The size of a {@link Button}: `sm` for inline row actions, `md` for page-level actions. */
export type ButtonSize = "sm" | "md";

const BASE_CLASSNAME =
  "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:opacity-60";

const SIZE_CLASSNAME: Readonly<Record<ButtonSize, string>> = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
};

const VARIANT_CLASSNAME: Readonly<Record<ButtonVariant, string>> = {
  primary:
    "border border-transparent bg-primary font-medium text-primary-foreground shadow-panel hover:not-disabled:bg-primary-strong",
  secondary:
    "border border-border bg-card font-medium text-foreground hover:not-disabled:bg-accent hover:not-disabled:text-accent-foreground",
  ghost:
    "border border-transparent bg-transparent text-muted-foreground hover:not-disabled:bg-accent hover:not-disabled:text-accent-foreground",
};

/** Props for {@link Button}. Extends the native button attributes. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
}

/**
 * The shared button for the dashboard's inline and page-level actions.
 * Defaults to the bordered `secondary` variant at the small size. `type`
 * defaults to `"button"` so callers never submit a form by accident, but a
 * caller can still override it.
 */
export function Button({
  variant = "secondary",
  size = "sm",
  className,
  type = "button",
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      type={type}
      className={cn(BASE_CLASSNAME, SIZE_CLASSNAME[size], VARIANT_CLASSNAME[variant], className)}
      {...props}
    />
  );
}
