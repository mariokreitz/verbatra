import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

/** One selectable segment in a {@link Tabs} strip. */
export interface TabItem<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

/** Props for {@link Tabs}. `label` names the group for assistive technology. */
export interface TabsProps<Id extends string> {
  readonly items: readonly TabItem<Id>[];
  readonly active: Id;
  readonly onChange: (id: Id) => void;
  readonly label: string;
}

/**
 * A horizontal segmented tab strip: a controlled `active`/`onChange` pair
 * over a small, fixed set of options, rendered as a `<fieldset>` of
 * `aria-pressed` toggle buttons. The active segment lifts onto a card surface
 * with a hairline border.
 */
export function Tabs<Id extends string>({
  items,
  active,
  onChange,
  label,
}: TabsProps<Id>): ReactNode {
  return (
    <fieldset className="m-0 inline-flex gap-1 rounded-md bg-muted p-1" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "rounded-sm px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            item.id === active &&
              "border border-border bg-card font-semibold text-foreground shadow-panel",
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
