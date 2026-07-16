import { Fragment, type ReactNode, type Ref } from "react";
import { Button } from "./Button.js";
import { Card } from "./Card.js";
import { Icon, type IconName } from "./Icon.js";
import { cn } from "./lib/cn.js";
import { Sheet } from "./Sheet.js";

/**
 * Shared presentational primitives every panel builds on, so the visual language (spacing, type
 * scale, table treatment) stays consistent across the dashboard instead of each panel inventing
 * its own. Purely presentational: none of these hold state or make an rpc call.
 */

/** A monospace value cell, for anything that reads as code: locale codes, formats, token counts. */
export function MonoValue({ children }: { readonly children: ReactNode }): ReactNode {
  return <span className="font-mono">{children}</span>;
}

/** A keyboard-key chip, for shortcut hints (the search pill, the shortcuts dialog). */
export function Kbd({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}

/** The centered, width-capped content column every page renders inside. */
export function Container({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>;
}

/** The click-outside-to-dismiss backdrop shared by every overlay (drawer, dialog, palette): a real
 * `<button>` behind the panel in both stacking order and the focus trap, not a click handler on a
 * static element, so dismissing by clicking outside stays a genuine, keyboard-operable control. */
export function OverlayBackdrop({
  onClose,
  label,
}: {
  readonly onClose: () => void;
  readonly label: string;
}): ReactNode {
  return (
    <button
      type="button"
      className="absolute inset-0 z-0 cursor-default border-none bg-foreground/40"
      onClick={onClose}
      aria-label={label}
    />
  );
}

/** The icon-only close button every overlay (`Sheet`, `Modal`, the mobile nav drawer) shows
 * next to its title, previously copy-pasted identically in each of the three. `label` defaults to
 * "Close" (what every existing caller already passed) but stays overridable, since the mobile nav
 * drawer's is more specific ("Close navigation"). */
export function DialogCloseButton({
  onClose,
  label = "Close",
  className,
}: {
  readonly onClose: () => void;
  readonly label?: string;
  readonly className?: string;
}): ReactNode {
  return (
    <Button
      variant="ghost"
      className={className ?? "flex-none p-1.5"}
      onClick={onClose}
      aria-label={label}
    >
      <Icon name="close" />
    </Button>
  );
}

/**
 * The side-drawer shell shared by `KeyDetailDrawer` and `EditEntryDialog`: a full-height panel
 * anchored to the end edge. A thin `side="end"` preset over the general-purpose `Sheet` (see
 * `Sheet.tsx`), kept as its own named export since "drawer" is the vocabulary the rest of this
 * dashboard's doc comments and both existing callers already use; the props and rendered output
 * are unchanged from before `Sheet` existed.
 */
export function DrawerShell(props: {
  readonly title: ReactNode;
  readonly ariaLabel: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly containerRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
}): ReactNode {
  return <Sheet side="end" {...props} />;
}

/** A titled block of panel content, replacing the old .panel-section/.panel-intro pairing. */
export function Section({
  title,
  intro,
  children,
}: {
  readonly title: string;
  readonly intro?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="mb-8">
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      {intro !== undefined ? <p className="mb-3 text-sm text-muted-foreground">{intro}</p> : null}
      {children}
    </section>
  );
}

/**
 * The designed "nothing here" placeholder: a dashed, centered block with a muted glyph, an
 * optional short title, and the explanatory copy as children. Used for every empty table, list,
 * and not-yet-recorded state, so "empty" always reads as a deliberate state of the page rather
 * than a rendering gap. `action` is a slot for a follow-up control if a caller ever has one;
 * most of this read-only dashboard's empty states are purely informational.
 */
export function EmptyState({
  icon = "inbox",
  title,
  action,
  children,
}: {
  readonly icon?: IconName;
  readonly title?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <Icon name={icon} size={20} className="text-muted-foreground/60" />
      {title !== undefined ? <p className="font-medium text-foreground">{title}</p> : null}
      <div className="max-w-md text-sm text-muted-foreground">{children}</div>
      {action}
    </div>
  );
}

/**
 * A page section rendered as a card with its own heading row: a title (an h2; the page's h1
 * belongs to `PageHeader`), an optional intro line under it, and an optional inline-end `meta`
 * slot for a badge or count. The card-per-section rhythm is what separates a screen into
 * scannable blocks; the plain `Section` above stays for lighter contexts (drawer content).
 */
export function SectionCard({
  title,
  intro,
  meta,
  children,
  className,
}: {
  readonly title: string;
  readonly intro?: ReactNode;
  readonly meta?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}): ReactNode {
  return (
    <Card as="section" padding="md" className={cn("mb-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {intro !== undefined ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{intro}</p>
          ) : null}
        </div>
        {meta !== undefined ? (
          <div className="flex flex-none items-center gap-2">{meta}</div>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** A compact key/value grid for read-only config-style fields, replacing .detail-list. */
export function DetailList({
  items,
}: {
  readonly items: ReadonlyArray<readonly [string, ReactNode]>;
}): ReactNode {
  return (
    <dl className="grid max-w-3xl grid-cols-[max-content_minmax(0,480px)] gap-x-6 gap-y-2">
      {items.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="m-0 text-sm text-foreground">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * Shared table classes (not a component, since header/body shapes vary too much across panels to
 * usefully wrap): `divide-y` on tbody draws a rule between rows without one trailing the last row,
 * so no last-child override is needed the way the old .data-table CSS required. The tinted header
 * row and full-width tables assume the `TableCard` (edge-to-edge card) or an in-card context.
 */
export const tableClasses = {
  table: "w-full min-w-[480px] border-collapse text-sm",
  th: "border-b border-border bg-muted/40 px-3 py-2 text-start text-xs font-semibold text-muted-foreground",
  tbody: "divide-y divide-border",
  td: "px-3 py-2 text-foreground",
  rowHover: "hover:bg-accent/40",
  /** For count/amount columns: end-aligned with fixed-rhythm digits. */
  numeric: "text-end tabular-nums",
};

/**
 * Shared shell for `Badge` and `DiffBadge`: a small tone-colored pill with a glyph and a
 * `border-s` accent, so the signal never rests on color alone. Only the per-tone color classes
 * (owned by each badge's own tone map) differ between the two vocabularies.
 */
export const pillClassName =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border-s-[3px] border-transparent px-2 py-1 text-xs font-semibold leading-tight";
export const pillGlyphClassName = "font-mono font-bold";
