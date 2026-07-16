import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";
import { pillClassName, pillGlyphClassName } from "./ui.js";

/** The four visual states a status pill can carry across the dashboard's panels. */
export type BadgeTone = "success" | "warning" | "neutral" | "danger";

/**
 * A glyph paired with each tone so the signal never rests on color alone: a colorblind reader (or
 * a low-color-fidelity display) still distinguishes success from danger by shape, not just hue.
 * Combined with the border-inline-start accent below, every tone carries two non-color cues in
 * addition to its color.
 */
const BADGE_GLYPH: Readonly<Record<BadgeTone, string>> = {
  success: "✓",
  warning: "!",
  neutral: "•",
  danger: "✕",
};

const BADGE_TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  success: "border-success bg-success-soft text-success",
  warning: "border-warning bg-warning-soft text-warning",
  neutral: "border-neutral bg-neutral-soft text-neutral",
  danger: "border-danger bg-danger-soft text-danger",
};

/**
 * A small colored pill for summarizing a sync or availability state at a glance (in sync versus
 * out of sync, pending changes versus up to date, a lock's per-locale drift, history availability).
 * Purely presentational: it renders whatever text the caller passes and never derives it. Every
 * tone also renders a fixed glyph, decorative to assistive technology (the text content already
 * says what the state is), so the pill is not distinguished by color alone.
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
      <span className={pillGlyphClassName} aria-hidden="true">
        {BADGE_GLYPH[tone]}
      </span>
      {children}
    </span>
  );
}
