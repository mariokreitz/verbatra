import { type ReactNode, useState } from "react";
import { Button, type ButtonVariant } from "./Button.js";
import { Popover } from "./Popover.js";

export interface DropdownItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
}

export interface DropdownProps {
  readonly label: string;
  readonly items: readonly DropdownItem[];
  readonly variant?: ButtonVariant;
  readonly align?: "start" | "end";
}

/**
 * A button that opens a list of actions, built on `Popover`: the trigger is the button itself,
 * so there is nothing for a caller to wire up beyond the item list. Selecting an item both calls
 * its `onSelect` and closes the list, the same "act and close" pattern this dashboard's other
 * overlays already use (for example the mobile nav drawer's tab-select-closes-drawer behavior).
 *
 * Deliberately not the WAI-ARIA `menu`/`menuitem` pattern: that pattern requires arrow-key,
 * Home/End, and typeahead navigation among items to be correct, none of which this component
 * implements, and claiming the role without the behavior is worse for a screen reader user than
 * not claiming it. This is a plain, `Tab`-navigable list of ordinary buttons in a popover instead,
 * `aria-haspopup="true"` (a generic popup) rather than `"menu"`.
 */
export function Dropdown({
  label,
  items,
  variant = "secondary",
  align = "start",
}: DropdownProps): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align={align}
      anchor={
        <Button
          variant={variant}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {label}
        </Button>
      }
    >
      <div className="m-0 flex flex-col p-0">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            className="block w-full rounded-md px-3 py-2 text-start text-sm text-foreground hover:not-disabled:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-60"
            onClick={() => {
              item.onSelect();
              setOpen(false);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </Popover>
  );
}
