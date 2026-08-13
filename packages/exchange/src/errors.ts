export type ExchangeErrorCode = "WORKBOOK_INVALID";

export class ExchangeError extends Error {
  readonly code: ExchangeErrorCode;

  constructor(code: ExchangeErrorCode, message: string) {
    super(message);
    this.name = "ExchangeError";
    this.code = code;
  }
}
