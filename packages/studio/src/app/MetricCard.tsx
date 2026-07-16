import type { ReactNode } from "react";
import { Card } from "./Card.js";
import { Icon, type IconName } from "./Icon.js";
import { cn } from "./lib/cn.js";
import { ProgressBar } from "./ProgressBar.js";
import { microLabelClassName } from "./ui.js";

const VALUE_TONE_CLASSNAME = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
} as const;

/**
 * An at-a-glance stat tile: a micro-label with an optional glyph, a prominent
 * figure under it, and optionally a one-line hint and a progress meter.
 * `tone` tints only the figure, never the label. Purely presentational.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  progress,
  progressTone = "primary",
}: {
  readonly label: string;
  /** The headline figure. A string truncates with a title attribute; any other ReactNode renders as-is. */
  readonly value: ReactNode;
  readonly hint?: string;
  readonly icon?: IconName;
  /** Tints the figure: "danger" for an alarming count, "success" for an all-clear reading. */
  readonly tone?: "default" | "success" | "danger";
  /** When set, renders a 0-100 meter under the value. */
  readonly progress?: number;
  /** The meter's tone; "danger" for an exceeded budget or similar alarm reading. */
  readonly progressTone?: "primary" | "danger";
}): ReactNode {
  const valueClassName = cn(
    "mt-2 font-mono text-2xl font-bold tabular-nums",
    VALUE_TONE_CLASSNAME[tone],
  );
  return (
    <Card padding="sm" className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className={microLabelClassName}>{label}</span>
        {icon !== undefined ? (
          <span className="grid size-7 flex-none place-items-center rounded-md bg-accent text-accent-foreground">
            <Icon name={icon} size={14} />
          </span>
        ) : null}
      </div>
      {typeof value === "string" ? (
        <div className={cn(valueClassName, "truncate")} title={value}>
          {value}
        </div>
      ) : (
        <div className={valueClassName}>{value}</div>
      )}
      {hint !== undefined ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {progress !== undefined ? (
        <ProgressBar percent={progress} tone={progressTone} className="mt-3" />
      ) : null}
    </Card>
  );
}
