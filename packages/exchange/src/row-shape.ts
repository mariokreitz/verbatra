import { z } from "zod";
import { COLUMN, HEADERS } from "./layout.js";
import type { WorkbookRow } from "./types.js";

/**
 * The zod boundary check on untrusted row content: key non-empty, status a known bucket. The review
 * fields fall back via `.catch` ("ok" / "") instead of rejecting, so a row exported before the review
 * columns existed, or an unrecognized review-status cell, still imports.
 */
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

/**
 * The header label of the only column the row-shape check can reject a row on. A blank-key row is
 * skipped before the shape check by both readers, and every other schema field is either an
 * unconstrained string or a tolerant `.catch` fallback, so the status enum is the sole reachable
 * failure. Named here so a malformed row can be reported by column without embedding any cell content.
 */
export const MALFORMED_ROW_COLUMN = "Status";

/** The outcome of shape-checking one row: the parsed row, or the header label it was rejected on. */
export type RowOutcome =
  | { readonly ok: true; readonly row: WorkbookRow }
  | { readonly ok: false; readonly column: string };

/** Read one column out of a positional cell list, treating an absent cell as empty. */
function cellAt(cells: readonly string[], column: number): string {
  return cells[column - 1] ?? "";
}

/**
 * Shape-check one row supplied as its cells in {@link COLUMN} order (index `COLUMN.x - 1`). This is the
 * single column-to-field mapping both readers share: the xlsx reader passes the worksheet row's cell
 * text and the delimited reader passes the record's parsed fields, so neither can drift on which column
 * carries which field. Returns the parsed row on success, or the offending column's header label on
 * failure: the read layer reports the failure as structured data instead of throwing, so one malformed
 * row never aborts the rest of its file.
 *
 * Only the Translation value is trimmed: it is the sole editable column, so trimming is the single
 * normalization point that makes a whitespace-only cell read back as "" (treated exactly like an empty
 * cell) and lets the unset sentinel match on trimmed content. Every other column, above all the Key and
 * Source-hash identifiers, is read verbatim so it round-trips exactly.
 */
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

/**
 * Flatten one row into its cells in {@link COLUMN} order, the inverse of {@link parseRowCells}. The
 * delimited writer serializes this list directly, so the write side maps columns through the same
 * {@link COLUMN} constants the read side does.
 */
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
