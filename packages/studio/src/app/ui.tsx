import { Fragment, type ReactNode, type Ref } from "react";
import { Button } from "./Button.js";
import { Card } from "./Card.js";
import { Icon, type IconName } from "./Icon.js";
import { cn } from "./lib/cn.js";
import { Sheet } from "./Sheet.js";

/**
 * Shared presentational primitives the panels build on, keeping spacing, type
 * scale, and table treatment consistent across the dashboard. Purely
 * presentational: none of these hold state or make an rpc call.
 */

/** A monospace value span, for anything that reads as code: locale codes, formats, counts. */
export function MonoValue({ children }: { readonly children: ReactNode }): ReactNode {
  return <span className="font-mono">{children}</span>;
}

/** The centered, width-capped content column every page renders inside. */
export function Container({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>;
}

/** The click-outside-to-dismiss backdrop shared by the overlays: a real
 * `<button>` behind the panel, not a click handler on a static element, so
 * dismissing by clicking outside stays a genuine, keyboard-operable control. */
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

/** The icon-only close button an overlay shows next to its title. `label`
 * defaults to "Close" and stays overridable for a more specific name. */
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
 * The side-drawer shell: a thin `side="end"` preset over {@link Sheet},
 * shared by the key-detail and edit-entry overlays.
 */
export function DrawerShell(props: {
  /** The micro-label above the title (see `Sheet`'s `kicker`). */
  readonly kicker?: string;
  readonly title: ReactNode;
  readonly ariaLabel: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly containerRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
}): ReactNode {
  return <Sheet side="end" {...props} />;
}

/** A titled block of drawer or panel content, with an optional intro line. */
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
      <h3 className={cn("mb-2", microLabelClassName)}>{title}</h3>
      {intro !== undefined ? <p className="mb-3 text-sm text-muted-foreground">{intro}</p> : null}
      {children}
    </section>
  );
}

/**
 * The "nothing here" placeholder: a dashed, centered block with a muted
 * glyph, an optional short title, and the explanatory copy as children.
 * `action` is a slot for an optional follow-up control.
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
 * An uncarded page section: a heading row (an h2 with an optional inline-end
 * meta slot) over free-form content. For a page's primary surfaces, where
 * wrapping the block in a card would just nest borders; {@link SectionCard}
 * is the treatment for secondary, self-contained blocks.
 */
export function PageSection({
  title,
  meta,
  children,
  className,
}: {
  readonly title: string;
  readonly meta?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}): ReactNode {
  return (
    <section className={cn("mb-10", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {meta !== undefined ? <div className="flex items-center gap-2">{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * A page section rendered as a card with its own heading row: an h2 title,
 * an optional intro line, and an optional inline-end `meta` slot for a badge
 * or count.
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

/** A compact key/value grid (`<dl>`) for read-only config-style fields. */
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
 * Shared table class strings, for tables whose header or body shape does not
 * fit the `Table` components. The tinted header row and full-width table
 * assume a `TableCard` or in-card context.
 */
export const tableClasses = {
  table: "w-full min-w-[480px] border-collapse text-sm",
  th: "border-b border-border bg-muted/60 px-3 py-2.5 text-start font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
  tbody: "divide-y divide-border",
  td: "px-3 py-2.5 text-foreground",
  rowHover: "hover:bg-accent/40",
  /** For count/amount columns: end-aligned with fixed-rhythm digits. */
  numeric: "text-end tabular-nums",
};

/**
 * The shared pill shell for `Badge` and `DiffBadge`: a rounded pill whose
 * per-tone color classes come from each badge's own tone map.
 */
export const pillClassName =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium leading-5";

/** The decorative leading dot inside a pill, colored by the pill's current text color. */
export const pillDotClassName = "size-1.5 flex-none rounded-full bg-current";

/**
 * The uppercase monospace micro-label used as the eyebrow across stat card
 * labels, section kickers, and the page header's context line.
 */
export const microLabelClassName =
  "font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
