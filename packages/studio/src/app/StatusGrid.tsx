import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import type { StatusData } from "../client/coverage.js";
import type { DiffLocale, KeyLocaleStatus } from "../client/diff-view.js";
import { deriveKeyLocaleStatus, driftKeys } from "../client/diff-view.js";
import { isRtlLocale } from "../client/locale-direction.js";
import type { GridArrowKey, GridPosition } from "../client/roving-tabindex.js";
import { moveGridFocus } from "../client/roving-tabindex.js";
import type { RefreshableView } from "../client/state.js";
import { Badge } from "./Badge.js";
import { DiffBadge } from "./DiffBadge.js";
import { cn } from "./lib/cn.js";
import { ProgressBar } from "./ProgressBar.js";
import { TableCard } from "./Table.js";
import { EmptyState } from "./ui.js";
import { useStatusData } from "./use-status-data.js";

const gridCellClassName = "px-3 py-2 text-start whitespace-nowrap";
const gridHeaderClassName =
  "border-b border-border bg-muted/40 px-3 py-2 text-start align-bottom text-xs font-semibold text-muted-foreground whitespace-nowrap";

export interface StatusGridProps {
  /** The Diff panel's already-loaded per-locale diff data; never re-fetched by this component. */
  readonly locales: readonly DiffLocale[];
  readonly onSelectKey: (key: string) => void;
}

const GRID_ARROW_KEYS: ReadonlySet<string> = new Set<GridArrowKey>([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function isGridArrowKey(key: string): key is GridArrowKey {
  return GRID_ARROW_KEYS.has(key);
}

function cellRefKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function percentForLocale(status: RefreshableView<StatusData>, locale: string): number | null {
  if (status.kind !== "data") {
    return null;
  }
  return status.data.rows.find((row) => row.locale === locale)?.percent ?? null;
}

/**
 * A locale header's completeness bar, sourced from `check()`'s own already-computed percentage
 * (`upToDate / (missing + stale + upToDate)`, see `client/coverage.ts`), never recomputed from the
 * diff key lists here: recounting client-side risks drifting from `check()`'s own numbers. `percent`
 * is only ever null while `status.check` has not yet produced any data (still loading, or its first
 * fetch failed); `unavailable` distinguishes those two so a genuine failure never sits mislabeled as
 * "still loading" forever. The grid itself does not depend on this: it already has everything it
 * needs to render from the diff data alone, whether or not the completeness fetch succeeds.
 */
function CompletenessBar({
  percent,
  unavailable,
}: {
  readonly percent: number | null;
  readonly unavailable: boolean;
}): ReactNode {
  if (percent === null) {
    return (
      <span className="mt-1 block text-xs font-normal text-muted-foreground">
        {unavailable ? "Coverage unavailable" : "Loading coverage"}
      </span>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2 text-xs font-normal text-muted-foreground">
      <ProgressBar percent={percent} className="w-[60px] flex-none" />
      <span className="whitespace-nowrap">{percent}% up to date</span>
    </div>
  );
}

interface GridCellProps {
  readonly status: KeyLocaleStatus;
  readonly row: number;
  readonly col: number;
  readonly isCurrent: boolean;
  readonly keyName: string;
  readonly localeName: string;
  readonly onActivate: (keyName: string) => void;
  readonly onArrow: (row: number, col: number, key: GridArrowKey) => void;
  readonly onFocusCell: (row: number, col: number) => void;
  readonly registerCell: (row: number, col: number, element: HTMLButtonElement | null) => void;
}

/**
 * One key/locale cell: a real, individually focusable button so a click and Enter share the same
 * activation path, roving-tabindex managed by the parent grid (only the current position's button
 * is in the Tab order; every other cell is reachable by arrow key, not Tab). Status rendering
 * reuses the exact convention `KeyDetailDrawer.tsx`'s `LocaleStatusRow` established: a plain
 * success badge for in-sync, `DiffBadge` for the three drift kinds.
 */
function GridCell({
  status,
  row,
  col,
  isCurrent,
  keyName,
  localeName,
  onActivate,
  onArrow,
  onFocusCell,
  registerCell,
}: GridCellProps): ReactNode {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (isGridArrowKey(event.key)) {
      event.preventDefault();
      onArrow(row, col, event.key);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(keyName);
    }
  }

  return (
    <td
      className={cn(gridCellClassName, "px-2 py-1")}
      dir={isRtlLocale(localeName) ? "rtl" : undefined}
    >
      <button
        type="button"
        ref={(element) => registerCell(row, col, element)}
        className="block w-full rounded-md p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        tabIndex={isCurrent ? 0 : -1}
        onFocus={() => onFocusCell(row, col)}
        onKeyDown={handleKeyDown}
        onClick={() => onActivate(keyName)}
        aria-label={`${keyName} in ${localeName}: ${status}`}
      >
        {status === "in-sync" ? <Badge tone="success">In sync</Badge> : <DiffBadge tone={status} />}
      </button>
    </td>
  );
}

interface GridBodyRowProps {
  readonly keyName: string;
  readonly row: number;
  readonly locales: readonly DiffLocale[];
  readonly position: GridPosition;
  readonly onActivate: (keyName: string) => void;
  readonly onArrow: (row: number, col: number, key: GridArrowKey) => void;
  readonly onFocusCell: (row: number, col: number) => void;
  readonly registerCell: (row: number, col: number, element: HTMLButtonElement | null) => void;
}

function GridBodyRow({
  keyName,
  row,
  locales,
  position,
  onActivate,
  onArrow,
  onFocusCell,
  registerCell,
}: GridBodyRowProps): ReactNode {
  const statusRows = deriveKeyLocaleStatus(locales, keyName);
  return (
    <tr className="hover:bg-accent/40">
      <th
        scope="row"
        className={cn(
          gridCellClassName,
          "sticky start-0 bg-card text-start font-mono text-sm font-semibold text-foreground",
        )}
      >
        {keyName}
      </th>
      {statusRows.map((cell, col) => (
        <GridCell
          key={cell.locale}
          status={cell.status}
          row={row}
          col={col}
          isCurrent={position.row === row && position.col === col}
          keyName={keyName}
          localeName={cell.locale}
          onActivate={onActivate}
          onArrow={onArrow}
          onFocusCell={onFocusCell}
          registerCell={registerCell}
        />
      ))}
    </tr>
  );
}

/**
 * Rows = keys, columns = locales, one cell = that key's status in that locale. Rows are the
 * drift-affected key union from `driftKeys` (see its own doc comment for the "not the full key
 * universe" scoping decision); a target locale with no target file at all needs no special case
 * here, since `readTarget` (sdk `diff-locales.ts`) already reports it as an empty resource, which
 * makes every source key "missing" for that locale through the normal diff data, and a key that
 * only exists as an orphaned entry in another locale is correctly "in sync" for the missing-file
 * locale (it is not a source key, so there is nothing to be missing).
 *
 * A `<table>` with one flat `<tr>` per key keeps the DOM row-virtualization-friendly: no nested
 * per-row wrapper structure to unwind if virtualization is added later.
 *
 * Keyboard navigation is a roving tabindex: exactly one cell is in the Tab order at a time (the
 * current position, initially the first key and first locale); arrow keys move it, wrapping at the
 * grid's edges, via the pure `moveGridFocus` (see `client/roving-tabindex.ts`); Enter or Space
 * opens the key detail drawer for that row's key, and a mouse click does the same. The grid does
 * not set an ARIA `grid` role: the native `<table>` semantics (with `scope="row"`/`scope="col"`)
 * already describe the structure correctly, and layering the full ARIA grid pattern (explicit
 * `row`/`gridcell` roles on every cell) is a bigger surface than this ticket's "keyboard-first
 * navigation" call asks for.
 */
export function StatusGrid({ locales, onSelectKey }: StatusGridProps): ReactNode {
  const keys = useMemo(() => driftKeys(locales), [locales]);
  const status = useStatusData();
  const [position, setPosition] = useState<GridPosition>({ row: 0, col: 0 });
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  function registerCell(row: number, col: number, element: HTMLButtonElement | null): void {
    const key = cellRefKey(row, col);
    if (element === null) {
      cellRefs.current.delete(key);
      return;
    }
    cellRefs.current.set(key, element);
  }

  function handleArrow(row: number, col: number, key: GridArrowKey): void {
    const next = moveGridFocus({ row, col }, key, {
      rowCount: keys.length,
      colCount: locales.length,
    });
    setPosition(next);
    cellRefs.current.get(cellRefKey(next.row, next.col))?.focus();
  }

  function handleFocusCell(row: number, col: number): void {
    setPosition({ row, col });
  }

  if (keys.length === 0) {
    return <EmptyState title="No drift">No drift-affected keys to show.</EmptyState>;
  }

  return (
    <TableCard>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={cn(gridHeaderClassName, "min-w-[160px]")}>
              Key
            </th>
            {locales.map((locale) => (
              <th
                key={locale.locale}
                scope="col"
                className={cn(gridHeaderClassName, "min-w-[140px]")}
                dir={isRtlLocale(locale.locale) ? "rtl" : undefined}
              >
                <span className="font-mono">{locale.locale}</span>
                <CompletenessBar
                  percent={percentForLocale(status, locale.locale)}
                  unavailable={status.kind === "error"}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {keys.map((keyName, row) => (
            <GridBodyRow
              key={keyName}
              keyName={keyName}
              row={row}
              locales={locales}
              position={position}
              onActivate={onSelectKey}
              onArrow={handleArrow}
              onFocusCell={handleFocusCell}
              registerCell={registerCell}
            />
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
