import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The shared logo-cloud tile used by both marquee strips (frameworks and providers) so the
// two read as a consistent pair. Logo-forward: a prominent brand icon, the name in the
// display face, and an optional muted secondary label. Presentational, so it stays a server
// component; the subtle hover (lift + glow border) is pure CSS and degrades under reduced
// motion.
export function LogoTile({
  icon,
  name,
  sub,
  className,
}: {
  icon: ReactNode;
  name: string;
  sub?: string;
  className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        "mx-1.5 inline-flex h-14 min-w-[12rem] items-center gap-3 rounded-xl border border-fd-border px-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--v-glow)_40%,var(--border-default))] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      style={{ background: "color-mix(in srgb, var(--surface-card) 70%, transparent)" }}
    >
      <span
        aria-hidden="true"
        className="flex w-6 shrink-0 justify-center text-[color:var(--accent)]"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className="text-[0.98rem] font-semibold text-fd-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {name}
        </span>
        {sub ? (
          <span className="font-mono text-[10.5px] text-[color:var(--text-faint)]">{sub}</span>
        ) : null}
      </span>
    </span>
  );
}
