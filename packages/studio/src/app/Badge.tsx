import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";
import { pillClassName, pillDotClassName } from "./ui.js";

/** The four visual states a status pill can carry across the dashboard's pages. */
export type BadgeTone = "success" | "warning" | "neutral" | "danger";

const BADGE_TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-neutral-soft text-neutral",
  danger: "bg-danger-soft text-danger",
};

/**
 * A small colored pill for summarizing a sync or availability state at a glance (in sync versus
 * out of sync, pending changes versus up to date, a lock's per-locale drift). Purely
 * presentational: it renders whatever text the caller passes and never derives it. The leading
 * dot is decorative; the text label itself is what distinguishes states, so color is never the
 * sole carrier.
 */
export function Badge({
  tone,
  children,
}: {
  readonly tone: BadgeTone;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <span className={cn(pillClassName, BADGE_TONE_CLASSES[tone])}>
      <span className={pillDotClassName} aria-hidden="true" />
      {children}
    </span>
  );
}
