import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { Card } from "./Card.js";
import { cn } from "./lib/cn.js";
import { tableClasses } from "./ui.js";

/**
 * Thin components over `ui.tsx`'s `tableClasses` strings: `StatusPanel`/`LockPanel`/
 * `ReviewPanel`/`OverviewPanel`'s glossary table all render a `<table className={tableClasses...}>`
 * shape identically, so this gives that shape names instead of every caller re-spelling the same
 * four classNames. `tableClasses` itself stays exported and in use directly wherever a table's
 * header/body doesn't fit this exact shape (for example `StatusGrid`'s own roving-tabindex grid,
 * and `KeyDetailDrawer`'s narrower table), which is why this doesn't replace it.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>): ReactNode {
  return <table className={cn(tableClasses.table, className)} {...props} />;
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>): ReactNode {
  return <thead {...props} />;
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): ReactNode {
  return <tbody className={cn(tableClasses.tbody, className)} {...props} />;
}

export function TableRow({
  className,
  hover = true,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { readonly hover?: boolean }): ReactNode {
  return <tr className={cn(hover && tableClasses.rowHover, className)} {...props} />;
}

export function TableHeaderCell({
  className,
  numeric = false,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { readonly numeric?: boolean }): ReactNode {
  return (
    <th className={cn(tableClasses.th, numeric && tableClasses.numeric, className)} {...props} />
  );
}

export function TableCell({
  className,
  mono = false,
  numeric = false,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  readonly mono?: boolean;
  readonly numeric?: boolean;
}): ReactNode {
  return (
    <td
      className={cn(
        tableClasses.td,
        mono && "font-mono",
        numeric && tableClasses.numeric,
        className,
      )}
      {...props}
    />
  );
}

/**
 * The edge-to-edge card a page-level table sits in: rounded, bordered, horizontally scrollable
 * when the table's minimum width exceeds the viewport, with the table's own tinted header row
 * meeting the card's edges flush.
 */
export function TableCard({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return <Card padding="none" className={cn("overflow-x-auto", className)} {...props} />;
}
