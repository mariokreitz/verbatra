import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "./lib/cn.js";

/**
 * The one bordered form-field look this dashboard uses for a real text input (the Diff panel's key
 * filter) and a multi-line editor (the edit-entry dialog's translation textarea): previously the
 * identical Tailwind string duplicated across both call sites. The command palette's search field
 * is a deliberately different, borderless treatment and does not use this.
 */
const FIELD_CLASSNAME =
  "mt-1 block w-full max-w-[320px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export function TextField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return <input className={cn(FIELD_CLASSNAME, className)} {...props} />;
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactNode {
  return <textarea className={cn(FIELD_CLASSNAME, className)} {...props} />;
}
