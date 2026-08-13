import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";
import { pillClassName, pillDotClassName } from "./ui.js";

export type DiffTone = "missing" | "changed" | "orphaned";

const DIFF_LABEL: Readonly<Record<DiffTone, string>> = {
  missing: "Missing",
  changed: "Changed",
  orphaned: "Orphaned",
};

const DIFF_TONE_CLASSES: Readonly<Record<DiffTone, string>> = {
  missing: "bg-diff-new-soft text-diff-new",
  changed: "bg-diff-changed-soft text-diff-changed",
  orphaned: "bg-diff-orphaned-soft text-diff-orphaned",
};

export function DiffBadge({ tone }: { readonly tone: DiffTone }): ReactNode {
  return (
    <span className={cn(pillClassName, DIFF_TONE_CLASSES[tone])}>
      <span className={pillDotClassName} aria-hidden="true" />
      {DIFF_LABEL[tone]}
    </span>
  );
}
