/**
 * A CLI-local usage error for malformed input (a flag value, a raw option shape): routed to exit 2
 * like an `SdkError`, never a raw `ZodError` or a stack trace.
 */
export class CliUsageError extends Error {
  /** Stable, secret-free code read by {@link toRenderableError}; branch on this, not the message. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CliUsageError";
    this.code = code;
  }
}
