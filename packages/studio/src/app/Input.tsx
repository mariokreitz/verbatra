import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon.js";
import { cn } from "./lib/cn.js";

const FIELD_CLASSNAME =
  "mt-1 block w-full max-w-[320px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** A multi-line text field with the dashboard's shared bordered-field look. */
export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactNode {
  return <textarea className={cn(FIELD_CLASSNAME, className)} {...props} />;
}

/**
 * A search-type input with a leading search glyph, for filter-as-you-type
 * fields. The glyph is decorative; the caller still labels the input itself
 * (a visible label or an aria-label).
 */
export function SearchInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return (
    <span className="relative block w-full max-w-[320px]">
      <Icon
        name="search"
        size={14}
        className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input type="search" className={cn(FIELD_CLASSNAME, "mt-0 ps-8", className)} {...props} />
    </span>
  );
}
