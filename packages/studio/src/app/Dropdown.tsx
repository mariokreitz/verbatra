import { type ReactNode, useState } from "react";
import { Button, type ButtonVariant } from "./Button.js";
import { Icon } from "./Icon.js";
import { Popover } from "./Popover.js";

/** One entry in a {@link Dropdown} list. */
export interface DropdownItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  /** Marks the item as the current choice in a pick-one dropdown: renders a
   * leading check and `aria-current`. Omit entirely for action lists. */
  readonly selected?: boolean;
}

/** Props for {@link Dropdown}. */
export interface DropdownProps {
  /** The trigger's content: a text label, or an icon for an icon-only trigger
   * (then pass `ariaLabel` so the button still has an accessible name). */
  readonly label: ReactNode;
  /** Accessible name for the trigger when `label` is not plain text. */
  readonly ariaLabel?: string;
  readonly items: readonly DropdownItem[];
  readonly variant?: ButtonVariant;
  readonly align?: "start" | "end";
}

/**
 * A button that opens a list of options, built on `Popover`. Selecting an item
 * calls its `onSelect` and closes the list.
 *
 * Deliberately not the WAI-ARIA `menu`/`menuitem` pattern: that pattern
 * requires arrow-key, Home/End, and typeahead navigation, none of which this
 * component implements. It is a plain, Tab-navigable list of ordinary buttons
 * in a popover, with `aria-haspopup="true"` (a generic popup) rather than
 * `"menu"`.
 */
export function Dropdown({
  label,
  ariaLabel,
  items,
  variant = "secondary",
  align = "start",
}: DropdownProps): ReactNode {
  const [open, setOpen] = useState(false);
  const hasSelection = items.some((item) => item.selected === true);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align={align}
      ariaLabel={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      anchor={
        <Button
          variant={variant}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => setOpen((current) => !current)}
        >
          {label}
          <Icon name="chevron-down" size={12} className="text-muted-foreground" />
        </Button>
      }
    >
      <div className="m-0 flex flex-col p-0">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            aria-current={item.selected === true || undefined}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm text-foreground hover:not-disabled:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-60"
            onClick={() => {
              item.onSelect();
              setOpen(false);
            }}
          >
            {hasSelection ? (
              <span className="w-4 flex-none text-primary">
                {item.selected === true ? <Icon name="check" size={14} /> : null}
              </span>
            ) : null}
            {item.label}
          </button>
        ))}
      </div>
    </Popover>
  );
}
