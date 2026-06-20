/**
 * Stable, machine-readable codes for workbook interchange failures.
 *
 * - `WORKBOOK_INVALID`: the returned workbook could not be parsed into the neutral row model.
 *   This covers a non-xlsx or corrupt file, a missing identifier column, an unexpected sheet
 *   shape, and every cap breach from {@link WorkbookLimits} (oversized on disk, oversized
 *   decompressed, too many zip entries, too many sheets/rows/cells).
 */
export type ExchangeErrorCode = "WORKBOOK_INVALID";

/**
 * A structured error for workbook boundary failures. Like the format adapters' `AdapterError`,
 * it deliberately carries only a code and a safe message: it never embeds raw cell content, a
 * host path, the buffer, or a raw library stack, so untrusted workbook input cannot leak back
 * through error text.
 */
export class ExchangeError extends Error {
  readonly code: ExchangeErrorCode;

  constructor(code: ExchangeErrorCode, message: string) {
    super(message);
    this.name = "ExchangeError";
    this.code = code;
  }
}
