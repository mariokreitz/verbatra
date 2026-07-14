/**
 * The neutral, format-agnostic row model the exchange package builds workbooks from and parses
 * workbooks back into. It carries no xlsx types: plain data the SDK composes.
 */

/** The diff bucket a row was exported under, shown to the translator as the row's status. */
export type RowStatus = "new" | "changed" | "unchanged";

/**
 * Whether a row's translation was flagged by the review heuristics for a second look. Read-only and
 * advisory, never a gate: a translator cannot clear it by editing a cell, and import never inspects it.
 */
export type ReviewStatus = "ok" | "review";

/** One exported/imported translation row, identified by its dotted key path, never by position. */
export interface WorkbookRow {
  /** The dotted key path. The sole round-trip identity; a row with no key is rejected on read. */
  readonly key: string;
  /** The source-locale value, shown read-only for reference. */
  readonly source: string;
  /** The existing target value if any, shown read-only for reference. */
  readonly currentTarget: string;
  /** The diff bucket this row was exported under. */
  readonly status: RowStatus;
  /**
   * The source content hash captured at export time, carried hidden and read-only so import can
   * detect a source that changed since export.
   */
  readonly sourceHash: string;
  /** The translator-filled value. Empty means "not translated yet" and is skipped on import. */
  readonly translation: string;
  /**
   * Read-only developer context (for example ARB's `@key.description` or XLIFF's `<note>`), shown
   * for reference only. Empty when the source entry carries none. Never read as a translation source
   * on import; a workbook built before this field existed simply has no Context column, and reading
   * it back yields an empty string, so import stays backward-compatible.
   */
  readonly context: string;
  /** Whether the row was flagged for human review by the review heuristics. Read-only, never a gate. */
  readonly reviewStatus: ReviewStatus;
  /**
   * A comma-and-space-joined, lowercase-hyphenated list of reason labels (for example
   * `"length-ratio-outlier, equals-source"`); empty when `reviewStatus` is `"ok"`.
   */
  readonly reviewReasons: string;
}

/** One target-locale data sheet: its locale and the rows to translate, in a stable order. */
export interface WorkbookSheet {
  /** The target locale this data sheet is for. */
  readonly locale: string;
  /** The rows for this locale, in the order they were computed (stable for determinism). */
  readonly rows: readonly WorkbookRow[];
}

/**
 * The neutral workbook source data: one data sheet per target locale, in config order. The
 * leading instructions sheet is not part of the model; {@link buildWorkbook} synthesizes it.
 */
export interface WorkbookModel {
  /** One data sheet per target locale, in config order. */
  readonly sheets: readonly WorkbookSheet[];
}

/** The parsed result of reading a returned workbook back into the neutral row model. */
export interface WorkbookData {
  /** One entry per recognized data sheet, in workbook order. */
  readonly sheets: readonly WorkbookSheet[];
}
