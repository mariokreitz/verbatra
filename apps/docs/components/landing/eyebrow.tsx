import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Lowercase mono label with a glow dot. Presentational only, so it stays a server
// component (no "use client"): nothing here is interactive.
export function Eyebrow({
  children,
  center = false,
}: {
  children: ReactNode;
  center?: boolean;
}): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-fd-muted-foreground",
        center && "justify-center",
      )}
    >
      <span
        aria-hidden="true"
        className="h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ background: "var(--v-glow)", boxShadow: "0 0 8px var(--v-glow)" }}
      />
      {children}
    </span>
  );
}
