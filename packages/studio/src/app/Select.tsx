import type { ReactNode, SelectHTMLAttributes } from "react";
import { Icon } from "./Icon.js";
import { cn } from "./lib/cn.js";

/**
 * A native `<select>` styled to match `TextField`'s bordered form-field look (see `Input.tsx`),
 * plus a chevron affordance since a native select otherwise renders no visual cue that it opens
 * a list. `appearance-none` removes the browser's own dropdown arrow so the custom one (a
 * pointer-events-none overlay, never a second interactive element) is the only one shown. Sizes
 * to its widest option, which is what a filter row wants; pass a width class to override.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): ReactNode {
  return (
    <span className="relative inline-block">
      <select
        className={cn(
          "block appearance-none rounded-md border border-border bg-background py-2 pe-8 ps-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-muted-foreground"
        aria-hidden="true"
      >
        <Icon name="chevron-down" size={14} />
      </span>
    </span>
  );
}
