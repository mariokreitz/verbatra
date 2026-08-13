export class CliUsageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CliUsageError";
    this.code = code;
  }
}
