/**
 * Hard caps bounding the parse of a returned workbook. The workbook is untrusted input (it
 * comes back from a translator), so every dimension that an attacker could inflate is capped
 * and every breach raises a structured {@link ExchangeError}. The on-disk size is bounded by
 * the SDK's TOCTOU-safe read before the bytes ever reach this package; the caps here bound
 * what the bytes expand into, because a small zip can inflate hugely (a "zip bomb").
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
 * The default caps. Generous for a real translation workbook (tens of thousands of rows) yet
 * far below the resource exhaustion a crafted file would otherwise reach. A single workbook of
 * this size is bounded to roughly 64 MiB decompressed, the same order as the SDK's on-disk cap.
 */
export const DEFAULT_WORKBOOK_LIMITS: WorkbookLimits = {
  maxDecompressedBytes: 64 * 1024 * 1024,
  maxEntryCount: 1024,
  maxSheetCount: 256,
  maxRowsPerSheet: 100_000,
  maxCellsPerRow: 64,
};
