import { Fragment, type ReactNode, type Ref } from "react";
import { Button } from "./Button.js";
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

/** The icon-only "×" close button every overlay (`Sheet`, `Modal`, the mobile nav drawer) shows
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
      className={className ?? "flex-none text-lg leading-none"}
      onClick={onClose}
      aria-label={label}
    >
      <span aria-hidden="true">&times;</span>
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

/** Shared className for a muted "nothing here" placeholder, exported so callers that need the
 * className alone (for example `CommitList`'s `emptyClassName` prop) stay in sync with `EmptyState`
 * below instead of hardcoding a copy of the string. */
export const emptyStateClassName = "rounded-lg bg-muted p-4 text-muted-foreground";

/** A muted placeholder for "nothing here", used for empty tables and lists. */
export function EmptyState({ children }: { readonly children: ReactNode }): ReactNode {
  return <p className={emptyStateClassName}>{children}</p>;
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
 * so no last-child override is needed the way the old .data-table CSS required.
 */
export const tableClasses = {
  table: "w-auto min-w-[480px] border-collapse text-sm",
  th: "border-b-2 border-border px-3 py-2 text-start text-xs font-semibold text-muted-foreground",
  tbody: "divide-y divide-border",
  td: "px-3 py-2 text-foreground",
  rowHover: "hover:bg-accent/40",
};

/**
 * Shared shell for `Badge` and `DiffBadge`: a small tone-colored pill with a glyph and a
 * `border-s` accent, so the signal never rests on color alone. Only the per-tone color classes
 * (owned by each badge's own tone map) differ between the two vocabularies.
 */
export const pillClassName =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border-s-[3px] border-transparent px-2 py-1 text-xs font-semibold leading-tight";
export const pillGlyphClassName = "font-mono font-bold";
