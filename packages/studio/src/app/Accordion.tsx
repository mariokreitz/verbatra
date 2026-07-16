import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/** Groups a set of `AccordionItem`s with consistent spacing between them. Purely a spacing
 * wrapper: each item manages its own open/closed state independently (native `<details>`), there
 * is no "only one open at a time" coordination here. */
export function Accordion({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="flex flex-col gap-3">{children}</div>;
}

/**
 * One collapsible section, built on the native `<details>`/`<summary>` pair rather than a
 * hand-rolled open/closed state and ARIA wiring: keyboard support (Enter/Space to toggle, focus
 * handling) and the expanded/collapsed semantics come from the browser for free. `summary` is
 * always visible; `children` renders only while expanded (native `<details>` behavior, not a
 * `display:none` toggle this component manages itself).
 */
export function AccordionItem({
  summary,
  defaultOpen = false,
  className,
  dir,
  children,
}: {
  readonly summary: ReactNode;
  /** The initial open/closed state, applied via the native `<details open>` attribute. Despite
   * the name, this is re-applied on every render where the value itself changes (React reconciles
   * `open` like any other prop, not as a true `defaultValue`-style one-time initializer), which
   * would silently override a reader's own manual toggle. Safe today because `DiffPanel`'s sole
   * caller passes a value that is stable for the component's whole mounted lifetime (diff data
   * isn't re-fetched on live-refresh, see that panel's own doc comment); do not pass a value here
   * that changes across renders without intending to force the section back to that state. */
  readonly defaultOpen?: boolean;
  readonly className?: string;
  /** Forwarded to the root `<details>`, not just the summary text, so a reader's text-direction
   * context covers the whole collapsible section (its content, not only its heading). */
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
