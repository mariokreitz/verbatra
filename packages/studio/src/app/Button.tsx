import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/cn.js";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonSize = "sm" | "md";

const BASE_CLASSNAME =
  "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:opacity-60";

const SIZE_CLASSNAME: Readonly<Record<ButtonSize, string>> = {
  // The compact inline-action size (row actions, dialog chrome), the default.
  sm: "px-2 py-1 text-xs",
  // Page-level actions (a PageHeader's contextual action, toolbar buttons).
  md: "px-3 py-1.5 text-sm",
};

const VARIANT_CLASSNAME: Readonly<Record<ButtonVariant, string>> = {
  // The one filled call-to-action look (RefreshToast's "Translate pending changes").
  primary:
    "border border-primary bg-accent text-primary hover:not-disabled:bg-primary hover:not-disabled:text-primary-foreground",
  // The default small inline action (Save, Retranslate, Edit, Approve, Reject).
  secondary: "border border-border bg-transparent text-foreground hover:not-disabled:bg-accent",
  // Icon-only or low-emphasis chrome (dialog close buttons, dismiss controls).
  ghost:
    "border border-transparent bg-transparent text-muted-foreground hover:not-disabled:bg-accent hover:not-disabled:text-foreground",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
}

/**
 * The one small inline-action button shape this dashboard uses (Save, Retranslate, Edit, Approve,
 * Reject, the refresh toast's translate-pending action, and icon-only close/dismiss controls),
 * previously three near-identical Tailwind strings duplicated across `RetranslateButton`,
 * `ReviewRowActions`, `EditEntryDialog`, `RefreshToast`, and every dialog's close button.
 * `type="button"` defaults so callers never need to repeat it, but a caller can still override it
 * (there is no submit-driven form in this dashboard, but nothing here should assume that).
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
