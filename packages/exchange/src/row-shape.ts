import { z } from "zod";
import { COLUMN, HEADERS } from "./layout.js";
import type { WorkbookDuplicateKey, WorkbookRow, WorkbookRowProblem } from "./types.js";

const rowSchema = z.object({
  key: z.string().min(1),
  source: z.string(),
  currentTarget: z.string(),
  status: z.enum(["new", "changed", "unchanged"]),
  sourceHash: z.string(),
  translation: z.string(),
  context: z.string(),
  reviewStatus: z.enum(["ok", "review"]).catch("ok"),
  reviewReasons: z.string().catch(""),
});

export const MALFORMED_ROW_COLUMN = "Status";

export type RowOutcome =
  | { readonly ok: true; readonly row: WorkbookRow }
  | { readonly ok: false; readonly column: string };

function cellAt(cells: readonly string[], column: number): string {
  return cells[column - 1] ?? "";
}

export function parseRowCells(cells: readonly string[]): RowOutcome {
  const result = rowSchema.safeParse({
    key: cellAt(cells, COLUMN.key),
    source: cellAt(cells, COLUMN.source),
    currentTarget: cellAt(cells, COLUMN.current),
    status: cellAt(cells, COLUMN.status),
    sourceHash: cellAt(cells, COLUMN.sourceHash),
    translation: cellAt(cells, COLUMN.translation).trim(),
    context: cellAt(cells, COLUMN.context),
    reviewStatus: cellAt(cells, COLUMN.reviewStatus),
    reviewReasons: cellAt(cells, COLUMN.reviewReasons),
  });
  if (!result.success) {
    return { ok: false, column: MALFORMED_ROW_COLUMN };
  }
  return { ok: true, row: result.data };
}

export interface RowPosition {
  readonly row: number;
  readonly line?: number;
}

export interface RowAccumulator {
  readonly rows: WorkbookRow[];
  readonly malformed: WorkbookRowProblem[];
  readonly duplicates: WorkbookDuplicateKey[];
  readonly seenKeys: Set<string>;
}

export function judgeRow(
  cells: readonly string[],
  locale: string,
  at: RowPosition,
  into: RowAccumulator,
): void {
  if (cellAt(cells, COLUMN.key) === "") {
    return;
  }
  const outcome = parseRowCells(cells);
  if (!outcome.ok) {
    into.malformed.push({ locale, ...at, column: outcome.column });
    return;
  }
  if (into.seenKeys.has(outcome.row.key)) {
    into.duplicates.push({ locale, key: outcome.row.key, ...at });
    return;
  }
  into.seenKeys.add(outcome.row.key);
  into.rows.push(outcome.row);
}

export function rowCells(row: WorkbookRow): readonly string[] {
  const cells: string[] = new Array<string>(HEADERS.length).fill("");
  cells[COLUMN.key - 1] = row.key;
  cells[COLUMN.source - 1] = row.source;
  cells[COLUMN.current - 1] = row.currentTarget;
  cells[COLUMN.status - 1] = row.status;
  cells[COLUMN.translation - 1] = row.translation;
  cells[COLUMN.sourceHash - 1] = row.sourceHash;
  cells[COLUMN.context - 1] = row.context;
  cells[COLUMN.reviewStatus - 1] = row.reviewStatus;
  cells[COLUMN.reviewReasons - 1] = row.reviewReasons;
  return cells;
}
