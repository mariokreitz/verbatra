import { Fragment, type ReactNode } from "react";
import { Button } from "./Button.js";
import { Icon, type IconName } from "./Icon.js";
import { cn } from "./lib/cn.js";
import { SearchTrigger } from "./SearchTrigger.js";
import { Tooltip } from "./Tooltip.js";
import { DialogCloseButton, OverlayBackdrop } from "./ui.js";
import { useDialogA11y } from "./use-dialog-a11y.js";

/** One labeled group of nav entries (for example "Translations": Status, Diff, Review). Purely a
 * presentation grouping over the same flat tab set the rest of the app already uses; it carries no
 * navigation behavior of its own. */
export interface NavGroup<Tab extends string> {
  readonly label: string;
  readonly tabs: readonly Tab[];
}

export interface SidebarNavProps<Tab extends string> {
  readonly groups: readonly NavGroup<Tab>[];
  readonly tabLabels: Readonly<Record<Tab, string>>;
  /** One glyph per tab; `Readonly<Record<...>>` makes a tab without an icon a compile error. */
  readonly tabIcons: Readonly<Record<Tab, IconName>>;
  readonly activeTab: Tab;
  readonly onSelectTab: (tab: Tab) => void;
}

export interface DesktopSidebarProps<Tab extends string> extends SidebarNavProps<Tab> {
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
function NavItem<Tab extends string>({
  tab,
  label,
  icon,
  isActive,
  collapsed,
  onSelect,
}: {
  readonly tab: Tab;
  readonly label: string;
  readonly icon: IconName;
  readonly isActive: boolean;
  readonly collapsed: boolean;
  readonly onSelect: (tab: Tab) => void;
}): ReactNode {
  const button = (
    <button
      type="button"
      aria-current={isActive || undefined}
      aria-label={collapsed ? label : undefined}
      className={navItemClassName(isActive, collapsed)}
      onClick={() => onSelect(tab)}
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

function SidebarNavList<Tab extends string>({
  groups,
  tabLabels,
  tabIcons,
  activeTab,
  onSelectTab,
  collapsed = false,
}: SidebarNavProps<Tab> & { readonly collapsed?: boolean }): ReactNode {
  return (
    <nav className="flex flex-col gap-4" aria-label="Sections">
      {groups.map((group, index) => (
        // A native fieldset/legend pair, not a div with role="group": the legend is natively the
        // group's accessible name, no manual aria-labelledby wiring needed. On the collapsed rail
        // the legend goes sr-only (the name must survive for assistive technology) and a thin
        // divider separates the groups visually instead.
        <Fragment key={group.label}>
          {collapsed && index > 0 ? (
            <span aria-hidden="true" className="mx-2 border-t border-border" />
          ) : null}
          <fieldset className="m-0 border-0 p-0">
            <legend
              className={cn(
                "w-full px-2.5 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/70",
                collapsed && "sr-only",
              )}
            >
              {group.label}
            </legend>
            <div className="flex flex-col gap-1">
              {group.tabs.map((candidate) => (
                <NavItem
                  key={candidate}
                  tab={candidate}
                  label={tabLabels[candidate]}
                  icon={tabIcons[candidate]}
                  isActive={candidate === activeTab}
                  collapsed={collapsed}
                  onSelect={onSelectTab}
                />
              ))}
            </div>
          </fieldset>
        </Fragment>
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

/** The persistent nav rail shown at and above the `md` breakpoint; hidden entirely below it,
 * where the top bar's menu button and {@link MobileNavDrawer} take over navigation. Collapses to
 * an icon-only rail whose entries keep their accessible names and gain visual tooltips. */
export function DesktopSidebar<Tab extends string>({
  collapsed,
  onToggleCollapsed,
  ...navProps
}: DesktopSidebarProps<Tab>): ReactNode {
  return (
    <aside
      className={cn(
        "hidden flex-none flex-col gap-4 border-e border-border bg-card py-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-14 px-2" : "w-60 px-3",
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNavList {...navProps} collapsed={collapsed} />
      </div>
      <CollapseToggle collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
    </aside>
  );
}

/** The off-canvas nav overlay the top bar's menu button opens: an `OverlayBackdrop` plus a
 * start-anchored panel, the mobile equivalent of {@link DesktopSidebar} (never collapsed; the
 * rail concept only exists on desktop). Only ever mounted while open (the app shell conditionally
 * renders it), matching this dashboard's other overlays' mount-is-open convention, so
 * `useDialogA11y` is always called with `isOpen: true`. Selecting a tab closes the drawer
 * immediately (the caller's `onSelectTab` also calls `onClose`), so the next screen is never
 * hidden behind it. */
export function MobileNavDrawer<Tab extends string>({
  onClose,
  onOpenSearch,
  ...navProps
}: SidebarNavProps<Tab> & {
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
        <SidebarNavList {...navProps} />
      </div>
    </div>
  );
}
