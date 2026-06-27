/**
 * Hard caps bounding the parse of an untrusted returned workbook. The on-disk size is bounded by
 * the SDK before the bytes reach this package; these caps bound what the bytes expand into, because
 * a small zip can inflate hugely (a zip bomb).
 */
export interface WorkbookLimits {
  /** Maximum total uncompressed bytes across all zip entries (decompression-bomb guard). */
  readonly maxDecompressedBytes: number;
  /** Maximum number of entries in the xlsx zip container. */
  readonly maxEntryCount: number;
  /** Maximum number of worksheets in the workbook. */
  readonly maxSheetCount: number;
  /** Maximum number of rows read per worksheet. */
  readonly maxRowsPerSheet: number;
  /** Maximum number of cells read per row. */
  readonly maxCellsPerRow: number;
}

/**
 * The default caps: generous for a real translation workbook yet far below the resource exhaustion
 * a crafted file would reach. A workbook of this size is bounded to roughly 64 MiB decompressed.
 */
export const DEFAULT_WORKBOOK_LIMITS: WorkbookLimits = {
  maxDecompressedBytes: 64 * 1024 * 1024,
  maxEntryCount: 1024,
  maxSheetCount: 256,
  maxRowsPerSheet: 100_000,
  maxCellsPerRow: 64,
};
