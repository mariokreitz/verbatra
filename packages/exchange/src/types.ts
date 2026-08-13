export type RowStatus = "new" | "changed" | "unchanged";

export type ReviewStatus = "ok" | "review";

export interface WorkbookRow {
  readonly key: string;
  readonly source: string;
  readonly currentTarget: string;
  readonly status: RowStatus;
  readonly sourceHash: string;
  readonly translation: string;
  readonly context: string;
  readonly reviewStatus: ReviewStatus;
  readonly reviewReasons: string;
}

export interface WorkbookSheet {
  readonly locale: string;
  readonly rows: readonly WorkbookRow[];
}

export interface WorkbookModel {
  readonly sheets: readonly WorkbookSheet[];
}

export interface WorkbookRowProblem {
  readonly locale: string;
  readonly row: number;
  readonly line?: number;
  readonly column: string;
}

export interface WorkbookDuplicateKey {
  readonly locale: string;
  readonly key: string;
  readonly row: number;
  readonly line?: number;
}

export interface WorkbookData {
  readonly sheets: readonly WorkbookSheet[];
  readonly malformedRows: readonly WorkbookRowProblem[];
  readonly duplicateKeys: readonly WorkbookDuplicateKey[];
}
