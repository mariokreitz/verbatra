import type { ReactNode } from "react";
import { Card } from "./Card.js";
import { Icon, type IconName } from "./Icon.js";
import { ProgressBar } from "./ProgressBar.js";

/**
 * The dashboard's at-a-glance stat tile: a small caps label, a prominent value, and optionally a
 * glyph, a one-line hint under the value, and a progress meter. The value renders in monospace
 * with tabular numerals so a row of these scans as a fixed-rhythm figure strip (Overview's config
 * facts, Status's coverage figures, Usage's token totals). Purely presentational.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  progress,
  progressTone = "primary",
}: {
  readonly label: string;
  /** The headline figure. A string truncates with a title attribute; any ReactNode (for example
   * a Badge for a stateful reading) renders as-is. */
  readonly value: ReactNode;
  readonly hint?: string;
  readonly icon?: IconName;
  /** When set, a 0-100 meter under the value (for example a locale's coverage percentage). */
  readonly progress?: number;
  /** The meter's tone; "danger" for an exceeded budget or similar alarm reading. */
  readonly progressTone?: "primary" | "danger";
}): ReactNode {
  return (
    <Card padding="sm" className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon !== undefined ? (
          <Icon name={icon} size={14} className="flex-none text-muted-foreground/70" />
        ) : null}
      </div>
      {typeof value === "string" ? (
        <div
          className="mt-2 truncate font-mono text-xl font-semibold tabular-nums text-foreground"
          title={value}
        >
          {value}
        </div>
      ) : (
        <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
      )}
      {hint !== undefined ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {progress !== undefined ? (
        <ProgressBar percent={progress} tone={progressTone} className="mt-3" />
      ) : null}
    </Card>
  );
}
