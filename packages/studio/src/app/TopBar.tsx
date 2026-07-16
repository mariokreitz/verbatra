import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";
import { SearchTrigger } from "./SearchTrigger.js";
import { ThemeSwitcher } from "./ThemeSwitcher.js";
import { Tooltip } from "./Tooltip.js";

export interface TopBarProps {
  /** The active page's label, the bar's orientation text. Not a heading; the h1 belongs to each
   * page's `PageHeader`. */
  readonly pageLabel: string;
  /** Opens the mobile nav drawer; the trigger only renders below the md breakpoint. */
  readonly onOpenNav: () => void;
  /** Opens the command palette, from the search pill (or its compact icon form). */
  readonly onOpenSearch: () => void;
  /** Opens the keyboard-shortcuts overview ("?" opens the same dialog). */
  readonly onOpenShortcuts: () => void;
}

/**
 * The application's fixed header row, always visible while the content column scrolls under it:
 * orientation on the start side (the mobile menu button and the current page's name; the nav is
 * flat, so there is no deeper trail to spell out), global actions on the end side (search,
 * shortcuts, theme).
 */
export function TopBar({
  pageLabel,
  onOpenNav,
  onOpenSearch,
  onOpenShortcuts,
}: TopBarProps): ReactNode {
  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <Button
        variant="ghost"
        className="p-1.5 md:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Icon name="menu" />
      </Button>
      <span className="text-sm font-semibold text-foreground">{pageLabel}</span>
      <div className="ms-auto flex items-center gap-1.5">
        <SearchTrigger onOpenSearch={onOpenSearch} className="hidden sm:flex" />
        <Button
          variant="ghost"
          className="p-1.5 sm:hidden"
          onClick={onOpenSearch}
          aria-label="Search"
        >
          <Icon name="search" />
        </Button>
        <Tooltip label="Keyboard shortcuts" side="bottom">
          <Button
            variant="ghost"
            className="p-1.5"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
          >
            <Icon name="keyboard" />
          </Button>
        </Tooltip>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
