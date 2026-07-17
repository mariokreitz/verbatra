import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { Card } from "./Card.js";
import { cn } from "./lib/cn.js";
import { tableClasses } from "./ui.js";

/**
 * A `<table>` carrying the shared `tableClasses.table` styling. Together with
 * the sibling components below, this names the dashboard's one standard table
 * shape instead of every caller re-spelling the same class strings.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>): ReactNode {
  return <table className={cn(tableClasses.table, className)} {...props} />;
}

/** A plain `<thead>`, kept for symmetry with the other table components. */
export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>): ReactNode {
  return <thead {...props} />;
}

/** A `<tbody>` carrying the shared `tableClasses.tbody` styling. */
export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): ReactNode {
  return <tbody className={cn(tableClasses.tbody, className)} {...props} />;
}

/** A `<tr>` with the shared hover tint, disabled via `hover={false}`. */
export function TableRow({
  className,
  hover = true,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { readonly hover?: boolean }): ReactNode {
  return <tr className={cn(hover && tableClasses.rowHover, className)} {...props} />;
}

/** A `<th>` with the shared header styling; `numeric` end-aligns the cell. */
export function TableHeaderCell({
  className,
  numeric = false,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { readonly numeric?: boolean }): ReactNode {
  return (
    <th className={cn(tableClasses.th, numeric && tableClasses.numeric, className)} {...props} />
  );
}

/** A `<td>` with the shared cell styling; `mono` uses the monospace face and `numeric` end-aligns. */
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
 * The edge-to-edge card a page-level table sits in: an unpadded `Card` that
 * scrolls horizontally when the table's minimum width exceeds the viewport.
 */
export function TableCard({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return <Card padding="none" className={cn("overflow-x-auto", className)} {...props} />;
}
