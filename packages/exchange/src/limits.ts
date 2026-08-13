export interface WorkbookLimits {
  readonly maxDecompressedBytes: number;
  readonly maxEntryCount: number;
  readonly maxSheetCount: number;
  readonly maxRowsPerSheet: number;
  readonly maxCellsPerRow: number;
}

export const DEFAULT_WORKBOOK_LIMITS: WorkbookLimits = {
  maxDecompressedBytes: 64 * 1024 * 1024,
  maxEntryCount: 1024,
  maxSheetCount: 256,
  maxRowsPerSheet: 100_000,
  maxCellsPerRow: 64,
};
