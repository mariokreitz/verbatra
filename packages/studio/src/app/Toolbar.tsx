import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/**
 * The horizontal control row between a page's header and its content: view switches, filters,
 * and the occasional inline action, all on one wrapping line with consistent gaps. `end` renders
 * pushed to the inline-end edge, for controls that read as secondary to the row's main filters.
 */
export function Toolbar({
  children,
  end,
  className,
}: {
  readonly children: ReactNode;
  readonly end?: ReactNode;
  readonly className?: string;
}): ReactNode {
  return (
    <div className={cn("mb-6 flex flex-wrap items-center gap-3", className)}>
      {children}
      {end !== undefined ? (
        <div className="ms-auto flex flex-wrap items-center gap-2">{end}</div>
      ) : null}
    </div>
  );
}

/**
 * A `Toolbar` specialization for filter controls: the same row, wrapped in a named group so
 * assistive technology announces the controls as the view's filters rather than loose inputs.
 * A native fieldset/legend pair (the legend visually hidden), matching the sidebar's own
 * grouping convention, rather than a div with role="group".
 */
export function FilterBar({
  children,
  label = "Filters",
  className,
}: {
  readonly children: ReactNode;
  /** The group's accessible name. */
  readonly label?: string;
  readonly className?: string;
}): ReactNode {
  return (
    <fieldset className={cn("m-0 mb-6 flex flex-wrap items-center gap-3 border-0 p-0", className)}>
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  );
}
