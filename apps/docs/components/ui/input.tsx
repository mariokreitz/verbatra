import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type InputProps = {
  prefix?: string;
} & ComponentPropsWithoutRef<"input">;

const WRAPPER =
  "not-prose flex items-center gap-2 rounded-[10px] border border-fd-border bg-fd-card px-3 py-2 transition-[border-color,box-shadow] focus-within:border-[var(--focus-ring)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v-purple)_22%,transparent)]";

export default function Input({ prefix, className, ...rest }: InputProps): ReactNode {
  return (
    <div className={`${WRAPPER}${className ? ` ${className}` : ""}`}>
      {prefix ? <span className="font-mono text-sm text-fd-muted-foreground">{prefix}</span> : null}
      <input className="flex-1 bg-transparent outline-none text-fd-foreground" {...rest} />
    </div>
  );
}
