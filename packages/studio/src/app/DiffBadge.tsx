import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";
import { pillClassName, pillGlyphClassName } from "./ui.js";

/**
 * The three kinds of pending change a key can carry for one locale. Deliberately a separate
 * vocabulary from Badge's `BadgeTone`: those tones answer "is this correct", these answer "what
 * kind of change is this". Reusing one token set for both would make a missing key and a broken
 * lock-file drift look like the same signal.
 */
export type DiffTone = "missing" | "changed" | "orphaned";

const DIFF_GLYPH: Readonly<Record<DiffTone, string>> = {
  missing: "+",
  changed: "~",
  orphaned: "−",
};

const DIFF_LABEL: Readonly<Record<DiffTone, string>> = {
  missing: "Missing",
  changed: "Changed",
  orphaned: "Orphaned",
};

const DIFF_TONE_CLASSES: Readonly<Record<DiffTone, string>> = {
  missing: "border-diff-new bg-diff-new-soft text-diff-new",
  changed: "border-diff-changed bg-diff-changed-soft text-diff-changed",
  orphaned: "border-diff-orphaned bg-diff-orphaned-soft text-diff-orphaned",
};

/**
 * A small pill for one diff-specific signal, styled from its own diff-* token family (see
 * styles.css), never Badge's status tokens. Pairs its color with a glyph and a
 * border-inline-start accent, same as Badge, so the signal does not rest on color alone.
 */
export function DiffBadge({ tone }: { readonly tone: DiffTone }): ReactNode {
  return (
    <span className={cn(pillClassName, DIFF_TONE_CLASSES[tone])}>
      <span className={pillGlyphClassName} aria-hidden="true">
        {DIFF_GLYPH[tone]}
      </span>
      {DIFF_LABEL[tone]}
    </span>
  );
}
