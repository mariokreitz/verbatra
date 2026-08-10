/**
 * Stable, machine-readable codes for interchange failures. One code covers both channels: a caller
 * branches on the code, never on which file shape produced it.
 *
 * - `WORKBOOK_INVALID`: the returned handoff could not be parsed into the neutral row model (a
 *   non-xlsx or corrupt workbook, a missing identifier column, an unexpected sheet shape, a
 *   delimited file with a missing or mismatched header line, or any cap breach from
 *   {@link WorkbookLimits} or {@link DelimitedLimits}), or, on the build side, a locale that cannot
 *   name its own destination: an invalid worksheet name (too long, a forbidden character, a
 *   collision with the reserved instructions sheet name, or a collision with another sheet locale),
 *   or a locale that cannot be a plain interchange file name.
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
