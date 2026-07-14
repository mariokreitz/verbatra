/**
 * Stable, machine-readable codes for workbook interchange failures.
 *
 * - `WORKBOOK_INVALID`: the returned workbook could not be parsed into the neutral row model (a
 *   non-xlsx or corrupt file, a missing identifier column, an unexpected sheet shape, or any cap
 *   breach from {@link WorkbookLimits}), or, on the build side, a sheet locale that cannot be a valid
 *   worksheet name (too long, a forbidden character, a collision with the reserved instructions sheet
 *   name, or a collision with another sheet locale).
 */
export type ExchangeErrorCode = "WORKBOOK_INVALID";

/**
 * A structured error for workbook boundary failures. It carries only a code and a safe message and
 * never embeds raw cell content, a host path, the buffer, or a raw library stack, so untrusted
 * workbook input cannot leak back through error text.
 */
export class ExchangeError extends Error {
  readonly code: ExchangeErrorCode;

  constructor(code: ExchangeErrorCode, message: string) {
    super(message);
    this.name = "ExchangeError";
    this.code = code;
  }
}
