import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/**
 * Stacks a set of `AccordionItem`s with consistent vertical spacing. Each item
 * keeps its own open state; there is no single-open coordination.
 */
export function Accordion({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="flex flex-col gap-3">{children}</div>;
}

/**
 * One collapsible section built on the native `<details>`/`<summary>` pair.
 * Keyboard support and expanded/collapsed semantics come from the browser.
 * `summary` is always visible; `children` shows only while expanded.
 */
export function AccordionItem({
  summary,
  defaultOpen = false,
  className,
  dir,
  children,
}: {
  readonly summary: ReactNode;
  /** Initial open state, applied through the `<details open>` attribute. React
   * re-applies it whenever the value changes, so a value that changes across
   * renders overrides a reader's manual toggle; pass a stable value unless that
   * is intended. */
  readonly defaultOpen?: boolean;
  readonly className?: string;
  /** Forwarded to the root `<details>` so the text direction covers the whole
   * section, not just the summary. */
  readonly dir?: "ltr" | "rtl" | undefined;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <details
      open={defaultOpen}
      dir={dir}
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <summary className="cursor-pointer list-none font-mono text-base marker:content-none [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
