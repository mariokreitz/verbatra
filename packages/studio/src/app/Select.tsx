import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "./lib/cn.js";

/**
 * A native `<select>` styled to match `TextField`'s bordered form-field look (see `Input.tsx`),
 * plus a small chevron affordance since a native select otherwise renders no visual cue that it
 * opens a list. `appearance-none` removes the browser's own dropdown arrow so the custom one
 * (drawn with a background image, not a second DOM element) is the only one shown.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): ReactNode {
  return (
    <div className="relative mt-1 inline-block w-full max-w-[320px]">
      <select
        className={cn(
          "block w-full appearance-none rounded-md border border-border bg-background px-3 py-2 pe-8 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-muted-foreground"
        aria-hidden="true"
      >
        &#9662;
      </span>
    </div>
  );
}
