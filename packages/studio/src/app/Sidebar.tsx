import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { cn } from "./lib/cn.js";
import { DialogCloseButton, OverlayBackdrop } from "./ui.js";
import { useDialogA11y } from "./use-dialog-a11y.js";

/** One labeled group of nav entries (for example "Translations": Status, Diff, Review). Purely a
 * presentation grouping over the same flat tab set the rest of the app already uses; it carries no
 * navigation behavior of its own. */
export interface NavGroup<Tab extends string> {
  readonly label: string;
  readonly tabs: readonly Tab[];
}

export interface SidebarProps<Tab extends string> {
  readonly groups: readonly NavGroup<Tab>[];
  readonly tabLabels: Readonly<Record<Tab, string>>;
  readonly activeTab: Tab;
  readonly onSelectTab: (tab: Tab) => void;
  /** Opens the command palette: the sidebar's global-search entry point, alongside the Ctrl/⌘+K
   * shortcut it already documents. */
  readonly onOpenSearch: () => void;
}

/** A search-styled button that opens the command palette: `TextField`'s bordered look with no
 * real input underneath, since typing a query only ever happens inside the palette itself once
 * open. Sits above the grouped nav in both the desktop sidebar and the mobile drawer. */
function SearchTrigger({ onOpenSearch }: { readonly onOpenSearch: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onOpenSearch}
      className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-start text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      Search…
      <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-xs">
        Ctrl/&#8984;+K
      </kbd>
    </button>
  );
}

function navItemClassName(isActive: boolean): string {
  return cn(
    "relative block w-full rounded-md px-3 py-2 text-start font-mono text-sm lowercase tracking-wide text-muted-foreground transition-colors",
    "hover:bg-accent hover:text-foreground",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "bg-accent font-semibold text-primary",
    isActive &&
      "before:absolute before:start-0 before:top-1/2 before:h-[1.1em] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-glow before:content-['']",
  );
}

/** The "V" mark plus wordmark, shared by the persistent desktop sidebar and the mobile nav drawer. */
function SidebarBrand(): ReactNode {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span
        className="grid size-6 flex-none place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
        aria-hidden="true"
      >
        V
      </span>
      <span className="text-sm font-semibold text-foreground">Verbatra Studio</span>
    </div>
  );
}

function SidebarNavList<Tab extends string>({
  groups,
  tabLabels,
  activeTab,
  onSelectTab,
}: SidebarProps<Tab>): ReactNode {
  return (
    <nav className="flex flex-col gap-4" aria-label="Sections">
      {groups.map((group) => (
        // A native fieldset/legend pair, not a div with role="group": the legend is natively
        // the group's accessible name, no manual aria-labelledby wiring needed. Styled to read as
        // this dashboard's mono, lowercase, tracked-out group-separator convention (matching the
        // docs site's own sidebar group labels, `#nd-sidebar p` in apps/docs/app/global.css)
        // rather than a fieldset's usual bordered-box default.
        <fieldset key={group.label} className="m-0 border-0 p-0">
          <legend className="w-full px-3 pb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </legend>
          <div className="flex flex-col gap-1">
            {group.tabs.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-current={candidate === activeTab || undefined}
                className={navItemClassName(candidate === activeTab)}
                onClick={() => onSelectTab(candidate)}
              >
                {tabLabels[candidate]}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </nav>
  );
}

/** The persistent sidebar shown at and above the `md` breakpoint; hidden entirely below it, where
 * {@link MobileTopBar} and {@link MobileNavDrawer} take over navigation. */
export function DesktopSidebar<Tab extends string>(props: SidebarProps<Tab>): ReactNode {
  return (
    <aside className="hidden w-56 flex-none flex-col gap-4 border-e border-border bg-card px-3 py-4 md:flex">
      <SidebarBrand />
      <SearchTrigger onOpenSearch={props.onOpenSearch} />
      <SidebarNavList {...props} />
    </aside>
  );
}

/** The mobile-only header bar: the current section's label plus a button that opens
 * {@link MobileNavDrawer}. Hidden at and above the `md` breakpoint, where the persistent
 * {@link DesktopSidebar} already shows every section. */
export function MobileTopBar({
  title,
  onOpenNav,
}: {
  readonly title: string;
  readonly onOpenNav: () => void;
}): ReactNode {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
      <Button
        variant="ghost"
        className="p-1.5 text-lg leading-none text-foreground"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <span aria-hidden="true">&#9776;</span>
      </Button>
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
    </header>
  );
}

/** The off-canvas nav overlay {@link MobileTopBar}'s menu button opens: an `OverlayBackdrop` plus a
 * start-anchored panel, the mobile equivalent of `DesktopSidebar`. Only ever mounted while open
 * (the app shell conditionally renders it), matching this dashboard's other overlays' mount-is-open
 * convention, so `useDialogA11y` is always called with `isOpen: true`. Selecting a tab closes the
 * drawer immediately (the caller's `onSelectTab` also calls `onClose`), so the next screen is never
 * hidden behind it. */
export function MobileNavDrawer<Tab extends string>({
  onClose,
  ...navProps
}: SidebarProps<Tab> & { readonly onClose: () => void }): ReactNode {
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  return (
    <div className="fixed inset-0 z-20 flex md:hidden">
      <OverlayBackdrop onClose={onClose} label="Close navigation" />
      <div
        className="relative z-10 flex h-full w-64 flex-col gap-6 bg-card px-3 py-4 shadow-panel-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        ref={containerRef}
      >
        <div className="flex items-center justify-between gap-2">
          <SidebarBrand />
          <DialogCloseButton onClose={onClose} label="Close navigation" />
        </div>
        <SearchTrigger
          onOpenSearch={() => {
            navProps.onOpenSearch();
            onClose();
          }}
        />
        <SidebarNavList {...navProps} />
      </div>
    </div>
  );
}
