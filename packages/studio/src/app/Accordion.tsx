import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

export function Accordion({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function AccordionItem({
  summary,
  defaultOpen = false,
  className,
  dir,
  children,
}: {
  readonly summary: ReactNode;
  readonly defaultOpen?: boolean;
  readonly className?: string;
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
