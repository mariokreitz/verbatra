import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";
import { pillClassName, pillDotClassName } from "./ui.js";

/** The visual tones a status pill can carry. */
export type BadgeTone = "success" | "warning" | "neutral" | "danger";

const BADGE_TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-neutral-soft text-neutral",
  danger: "bg-danger-soft text-danger",
};

/**
 * A small colored pill for a status label. Purely presentational: it renders
 * the text the caller passes and never derives it. The leading dot is
 * decorative; the label text distinguishes states, so color is never the sole
 * carrier.
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
