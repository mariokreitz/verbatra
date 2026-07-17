/** The four arrow keys a keyboard-navigable grid moves focus with. */
export type GridArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** A cell's position in a grid, zero-indexed. */
export interface GridPosition {
  readonly row: number;
  readonly col: number;
}

/** A grid's extent: how many rows and columns it has. */
export interface GridDimensions {
  readonly rowCount: number;
  readonly colCount: number;
}

function wrapIndex(value: number, count: number): number {
  return ((value % count) + count) % count;
}

/**
 * Moves a roving-tabindex position one step in the given arrow-key direction, wrapping at the
 * grid's edges: Up from row 0 goes to the last row, Down from the last row goes to row 0, Left
 * from column 0 goes to the last column, and Right from the last column goes to column 0. Pure
 * arithmetic only; it never touches focus or the DOM, so the caller is responsible for moving
 * actual DOM focus to the cell at the returned position.
 *
 * Returns `position` unchanged for a grid with no rows or no columns, since there is nowhere to
 * move to (guards a division-by-zero in the wrap calculation, not an error case).
 */
export function moveGridFocus(
  position: GridPosition,
  key: GridArrowKey,
  dimensions: GridDimensions,
): GridPosition {
  const { rowCount, colCount } = dimensions;
  if (rowCount <= 0 || colCount <= 0) {
    return position;
  }
  switch (key) {
    case "ArrowUp":
      return { row: wrapIndex(position.row - 1, rowCount), col: position.col };
    case "ArrowDown":
      return { row: wrapIndex(position.row + 1, rowCount), col: position.col };
    case "ArrowLeft":
      return { row: position.row, col: wrapIndex(position.col - 1, colCount) };
    case "ArrowRight":
      return { row: position.row, col: wrapIndex(position.col + 1, colCount) };
  }
}

/**
 * Clamps a stored roving position into the grid's current dimensions. The grid re-renders live
 * as keys resolve, so a remembered position can point past the shrunken row list; rendering an
 * unclamped position would leave no cell with tabIndex 0 and drop the whole grid out of the Tab
 * order. Degenerate dimensions (an empty grid) clamp to the origin; the caller does not render
 * a grid at all in that case.
 */
export function clampGridPosition(position: GridPosition, grid: GridDimensions): GridPosition {
  const row = Math.min(position.row, Math.max(0, grid.rowCount - 1));
  const col = Math.min(position.col, Math.max(0, grid.colCount - 1));
  if (row === position.row && col === position.col) {
    return position;
  }
  return { row, col };
}
