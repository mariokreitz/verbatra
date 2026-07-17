import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/**
 * A horizontal control row between a page's header and its content: one
 * wrapping line with consistent gaps. `end` renders pushed to the inline-end
 * edge.
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
 * A control row for filter controls: a native fieldset/legend pair (the
 * legend visually hidden) so assistive technology announces the controls as
 * a named group rather than loose inputs.
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
