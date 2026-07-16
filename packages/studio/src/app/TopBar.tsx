import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs.js";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";
import { SearchTrigger } from "./SearchTrigger.js";
import { ThemeSwitcher } from "./ThemeSwitcher.js";
import { Tooltip } from "./Tooltip.js";

export interface TopBarProps {
  /** The active tab's nav-group label, the first breadcrumb. */
  readonly groupLabel: string;
  /** The active tab's own label, the current-page breadcrumb. */
  readonly tabLabel: string;
  /** Opens the mobile nav drawer; the trigger only renders below the md breakpoint. */
  readonly onOpenNav: () => void;
  /** Opens the command palette, from the search pill (or its compact icon form). */
  readonly onOpenSearch: () => void;
  /** Opens the keyboard-shortcuts overview ("?" opens the same dialog). */
  readonly onOpenShortcuts: () => void;
}

/**
 * The application's fixed header row, always visible while the content column scrolls under it:
 * orientation on the start side (the mobile menu button, then breadcrumbs on desktop or the bare
 * section label on mobile), global actions on the end side (search, theme). It carries no page
 * heading itself; the h1 belongs to each panel's `PageHeader`.
 */
export function TopBar({
  groupLabel,
  tabLabel,
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
      <div className="hidden md:block">
        <Breadcrumbs items={[{ label: groupLabel }, { label: tabLabel }]} />
      </div>
      <span className="text-sm font-semibold text-foreground md:hidden">{tabLabel}</span>
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
