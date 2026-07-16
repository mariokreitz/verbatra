import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

export interface TabItem<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

export interface TabsProps<Id extends string> {
  readonly items: readonly TabItem<Id>[];
  readonly active: Id;
  readonly onChange: (id: Id) => void;
  readonly label: string;
}

/**
 * A horizontal segmented tab strip: a controlled `active`/`onChange` pair over a small, fixed set
 * of options, rendered as a native `<fieldset>` (an accessible group with no extra ARIA wiring
 * needed) with `aria-pressed` toggle buttons. `DiffPanel`'s grid/list view switch used to hand-roll
 * this exact shape; it now renders through this component instead of duplicating the classNames.
 */
export function Tabs<Id extends string>({
  items,
  active,
  onChange,
  label,
}: TabsProps<Id>): ReactNode {
  return (
    <fieldset
      className="m-0 inline-flex gap-1 rounded-md border border-border p-1"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "rounded-sm px-3 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            item.id === active && "bg-accent font-semibold text-primary",
          )}
          aria-pressed={item.id === active}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
