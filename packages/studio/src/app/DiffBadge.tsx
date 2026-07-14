import type { ReactNode } from "react";

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

/**
 * A small pill for one diff-specific signal, styled from its own `--diff-*` token family (see
 * styles.css), never Badge's status tokens. Pairs its color with a glyph and a
 * border-inline-start accent, same as Badge, so the signal does not rest on color alone.
 */
export function DiffBadge({ tone }: { readonly tone: DiffTone }): ReactNode {
  return (
    <span className={`diff-badge diff-badge-${tone}`}>
      <span className="diff-badge-glyph" aria-hidden="true">
        {DIFF_GLYPH[tone]}
      </span>
      {DIFF_LABEL[tone]}
    </span>
  );
}
