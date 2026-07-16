import type { ReactNode } from "react";
import type { PageId } from "../client/routes.js";
import { Button } from "./Button.js";
import { Icon, type IconName } from "./Icon.js";
import { cn } from "./lib/cn.js";
import { SearchTrigger } from "./SearchTrigger.js";
import { Tooltip } from "./Tooltip.js";
import { DialogCloseButton, OverlayBackdrop } from "./ui.js";
import { useDialogA11y } from "./use-dialog-a11y.js";

export interface SidebarNavProps {
  /** The daily work surfaces, at the top of the rail. */
  readonly workPages: readonly PageId[];
  /** The occasional-lookup pages, in the bottom zone next to the collapse toggle. */
  readonly referencePages: readonly PageId[];
  readonly pageLabels: Readonly<Record<PageId, string>>;
  /** One glyph per page; `Readonly<Record<...>>` makes a page without an icon a compile error. */
  readonly pageIcons: Readonly<Record<PageId, IconName>>;
  readonly activePage: PageId;
  readonly onSelectPage: (page: PageId) => void;
}

export interface DesktopSidebarProps extends SidebarNavProps {
  /** Collapsed to the icon rail. Persisted by the caller (see `lib/sidebar-dom.ts`). */
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
}

function navItemClassName(isActive: boolean, collapsed: boolean): string {
  return cn(
    "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors",
    collapsed && "justify-center px-0",
    "hover:bg-accent hover:text-foreground",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "bg-accent text-primary",
    isActive &&
      !collapsed &&
      "before:absolute before:start-0 before:top-1/2 before:h-[1.1em] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']",
  );
}

/** The "V" mark plus wordmark, shared by the desktop sidebar (mark only while collapsed) and the
 * mobile nav drawer. */
function SidebarBrand({ collapsed = false }: { readonly collapsed?: boolean }): ReactNode {
  return (
    <div className={cn("flex items-center gap-2 py-2", collapsed ? "justify-center" : "px-2.5")}>
      <span
        className="grid size-6 flex-none place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
        aria-hidden="true"
      >
        V
      </span>
      {collapsed ? null : (
        <span className="whitespace-nowrap text-sm font-semibold text-foreground">
          Verbatra Studio
        </span>
      )}
    </div>
  );
}

/** One nav entry: icon plus label expanded, a tooltip-labeled icon on the collapsed rail. The
 * button always carries the label as its accessible name; the tooltip is a sighted-user aid. */
function NavItem({
  page,
  label,
  icon,
  isActive,
  collapsed,
  onSelect,
}: {
  readonly page: PageId;
  readonly label: string;
  readonly icon: IconName;
  readonly isActive: boolean;
  readonly collapsed: boolean;
  readonly onSelect: (page: PageId) => void;
}): ReactNode {
  const button = (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={navItemClassName(isActive, collapsed)}
      onClick={() => onSelect(page)}
    >
      <Icon name={icon} className="flex-none" />
      {collapsed ? null : <span className="truncate">{label}</span>}
    </button>
  );
  if (!collapsed) {
    return button;
  }
  return <Tooltip label={label}>{button}</Tooltip>;
}

/** One zone's nav list: a plain named `<nav>` of items, no group chrome. The two-zone split
 * (work at the top, reference at the bottom) is the whole information architecture, so the
 * layout carries it instead of labeled group headers. */
function NavList({
  pages,
  navLabel,
  collapsed,
  ...itemProps
}: {
  readonly pages: readonly PageId[];
  readonly navLabel: string;
  readonly collapsed: boolean;
  readonly pageLabels: Readonly<Record<PageId, string>>;
  readonly pageIcons: Readonly<Record<PageId, IconName>>;
  readonly activePage: PageId;
  readonly onSelectPage: (page: PageId) => void;
}): ReactNode {
  return (
    <nav className="flex flex-col gap-1" aria-label={navLabel}>
      {pages.map((page) => (
        <NavItem
          key={page}
          page={page}
          label={itemProps.pageLabels[page]}
          icon={itemProps.pageIcons[page]}
          isActive={page === itemProps.activePage}
          collapsed={collapsed}
          onSelect={itemProps.onSelectPage}
        />
      ))}
    </nav>
  );
}

/** The rail's footer control: collapse (labeled) when expanded, expand (tooltip) when collapsed. */
function CollapseToggle({
  collapsed,
  onToggleCollapsed,
}: {
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
}): ReactNode {
  if (collapsed) {
    return (
      <Tooltip label="Expand sidebar">
        <Button
          variant="ghost"
          className="w-full justify-center p-2"
          onClick={onToggleCollapsed}
          aria-label="Expand sidebar"
          aria-expanded={false}
        >
          <Icon name="panel" />
        </Button>
      </Tooltip>
    );
  }
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2.5 px-2.5 py-2 text-sm"
      onClick={onToggleCollapsed}
      aria-label="Collapse sidebar"
      aria-expanded={true}
    >
      <Icon name="panel" className="flex-none" />
      Collapse
    </Button>
  );
}

/**
 * The persistent nav rail shown at and above the `md` breakpoint; hidden entirely below it,
 * where the top bar's menu button and {@link MobileNavDrawer} take over navigation. Collapses to
 * an icon-only rail whose entries keep their accessible names and gain visual tooltips. The work
 * zone scrolls only while expanded: on the collapsed rail the wrapper stays overflow-visible so
 * the tooltips, positioned outside the rail's width, are never clipped by a scroll container.
 */
export function DesktopSidebar({
  collapsed,
  onToggleCollapsed,
  ...navProps
}: DesktopSidebarProps): ReactNode {
  return (
    <aside
      className={cn(
        "hidden flex-none flex-col border-e border-border bg-card py-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-14 px-2" : "w-60 px-3",
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <div className={cn("mt-4 min-h-0 flex-1", !collapsed && "overflow-y-auto")}>
        <NavList
          pages={navProps.workPages}
          navLabel="Workspaces"
          collapsed={collapsed}
          {...navProps}
        />
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <NavList
          pages={navProps.referencePages}
          navLabel="Reference"
          collapsed={collapsed}
          {...navProps}
        />
        <CollapseToggle collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </div>
    </aside>
  );
}

/** The off-canvas nav overlay the top bar's menu button opens: an `OverlayBackdrop` plus a
 * start-anchored panel, the mobile equivalent of {@link DesktopSidebar} (never collapsed; the
 * rail concept only exists on desktop). Only ever mounted while open (the app shell conditionally
 * renders it), matching this dashboard's other overlays' mount-is-open convention, so
 * `useDialogA11y` is always called with `isOpen: true`. Selecting a page closes the drawer
 * immediately (the caller's `onSelectPage` also closes it), so the next screen is never hidden
 * behind it. */
export function MobileNavDrawer({
  onClose,
  onOpenSearch,
  ...navProps
}: SidebarNavProps & {
  readonly onClose: () => void;
  /** Opens the command palette; the drawer closes itself first. */
  readonly onOpenSearch: () => void;
}): ReactNode {
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
          className="w-full"
          onOpenSearch={() => {
            onOpenSearch();
            onClose();
          }}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList
            pages={navProps.workPages}
            navLabel="Workspaces"
            collapsed={false}
            {...navProps}
          />
        </div>
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <NavList
            pages={navProps.referencePages}
            navLabel="Reference"
            collapsed={false}
            {...navProps}
          />
        </div>
      </div>
    </div>
  );
}
