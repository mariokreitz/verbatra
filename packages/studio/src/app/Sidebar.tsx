import type { ReactNode } from "react";
import type { PageId } from "../client/routes.js";
import { Icon, type IconName } from "./Icon.js";
import { cn } from "./lib/cn.js";
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

/**
 * The rail is a constant dark-indigo surface in both themes (see styles.css's sidebar tokens),
 * so its item classes speak the sidebar-* vocabulary rather than the theme-responsive one.
 */
function navItemClassName(isActive: boolean, collapsed: boolean): string {
  return cn(
    "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-muted transition-colors",
    collapsed && "justify-center px-0",
    "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-active",
    isActive && "bg-sidebar-accent text-sidebar-foreground",
    isActive &&
      !collapsed &&
      "before:absolute before:start-0 before:top-1/2 before:h-[1.1em] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-active before:content-['']",
  );
}

/** The "V" mark plus the two-line wordmark (product name over the product-area line), shared by
 * the desktop sidebar (mark only while collapsed) and the mobile nav drawer. */
function SidebarBrand({ collapsed = false }: { readonly collapsed?: boolean }): ReactNode {
  return (
    <div className={cn("flex items-center gap-2.5 py-2", collapsed ? "justify-center" : "px-2.5")}>
      <span
        className="grid size-7 flex-none place-items-center rounded-md bg-sidebar-active text-xs font-bold text-white"
        aria-hidden="true"
      >
        V
      </span>
      {collapsed ? null : (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-sidebar-foreground">Verbatra</span>
          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-sidebar-muted">
            Localization Studio
          </span>
        </span>
      )}
    </div>
  );
}

/** A zone's uppercase monospace group label; hidden on the collapsed rail, where the two-zone
 * layout alone carries the taxonomy. */
function ZoneLabel({
  children,
  collapsed,
}: {
  readonly children: string;
  readonly collapsed: boolean;
}): ReactNode {
  if (collapsed) {
    return null;
  }
  return (
    <p className="mb-1 mt-0 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/80">
      {children}
    </p>
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

/** One zone's nav list: a plain named `<nav>` of items under its zone label. */
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
      <ZoneLabel collapsed={collapsed}>{navLabel}</ZoneLabel>
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

/** The documentation and issue-tracker links in the rail's footer, the design reference's
 * bottom-of-rail help zone. Plain external links: they open the public docs site and the GitHub
 * repository, the two places help for this dashboard actually lives. */
function HelpLinks({ collapsed }: { readonly collapsed: boolean }): ReactNode {
  const links: ReadonlyArray<{
    readonly label: string;
    readonly href: string;
    readonly icon: IconName;
  }> = [
    { label: "Documentation", href: "https://verbatra.kreitz-webdev.de", icon: "book" },
    {
      label: "Help and issues",
      href: "https://github.com/mariokreitz/verbatra/issues",
      icon: "help",
    },
  ];
  return (
    <nav className="flex flex-col gap-1" aria-label="Help">
      {links.map((link) => {
        const anchor = (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={collapsed ? link.label : undefined}
            className={navItemClassName(false, collapsed)}
          >
            <Icon name={link.icon} className="flex-none" />
            {collapsed ? null : <span className="truncate">{link.label}</span>}
          </a>
        );
        if (!collapsed) {
          return anchor;
        }
        return (
          <Tooltip label={link.label} key={link.label}>
            {anchor}
          </Tooltip>
        );
      })}
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
  const buttonClassName = cn(
    navItemClassName(false, collapsed),
    "justify-start",
    collapsed && "justify-center",
  );
  if (collapsed) {
    return (
      <Tooltip label="Expand sidebar">
        <button
          type="button"
          className={buttonClassName}
          onClick={onToggleCollapsed}
          aria-label="Expand sidebar"
          aria-expanded={false}
        >
          <Icon name="panel" className="flex-none" />
        </button>
      </Tooltip>
    );
  }
  return (
    <button
      type="button"
      className={buttonClassName}
      onClick={onToggleCollapsed}
      aria-label="Collapse sidebar"
      aria-expanded={true}
    >
      <Icon name="panel" className="flex-none" />
      Collapse
    </button>
  );
}

/**
 * The persistent nav rail shown at and above the `md` breakpoint; hidden entirely below it,
 * where the top bar's menu button and {@link MobileNavDrawer} take over navigation. A constant
 * dark-indigo surface in both themes (the design reference's anchoring chrome). Collapses to an
 * icon-only rail whose entries keep their accessible names and gain visual tooltips. The work
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
        "hidden flex-none flex-col border-e border-sidebar-border bg-sidebar py-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-14 px-2" : "w-60 px-3",
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <div className={cn("mt-5 min-h-0 flex-1", !collapsed && "overflow-y-auto")}>
        <NavList
          pages={navProps.workPages}
          navLabel="Workspace"
          collapsed={collapsed}
          {...navProps}
        />
        <div className="mt-5">
          <NavList
            pages={navProps.referencePages}
            navLabel="Reference"
            collapsed={collapsed}
            {...navProps}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        <HelpLinks collapsed={collapsed} />
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
  ...navProps
}: SidebarNavProps & {
  readonly onClose: () => void;
}): ReactNode {
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  return (
    <div className="fixed inset-0 z-20 flex md:hidden">
      <OverlayBackdrop onClose={onClose} label="Close navigation" />
      <div
        className="relative z-10 flex h-full w-64 flex-col gap-6 bg-sidebar px-3 py-4 shadow-panel-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        ref={containerRef}
      >
        <div className="flex items-center justify-between gap-2">
          <SidebarBrand />
          <DialogCloseButton
            onClose={onClose}
            label="Close navigation"
            className="flex-none p-1.5 text-sidebar-muted hover:not-disabled:bg-sidebar-accent hover:not-disabled:text-sidebar-foreground"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList
            pages={navProps.workPages}
            navLabel="Workspace"
            collapsed={false}
            {...navProps}
          />
          <div className="mt-5">
            <NavList
              pages={navProps.referencePages}
              navLabel="Reference"
              collapsed={false}
              {...navProps}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
          <HelpLinks collapsed={false} />
        </div>
      </div>
    </div>
  );
}
