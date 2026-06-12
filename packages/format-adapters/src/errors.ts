/** Stable, machine-readable codes for adapter failures. */
export type AdapterErrorCode =
  | "INVALID_JSON"
  | "INVALID_STRUCTURE"
  | "MAX_DEPTH_EXCEEDED"
  | "INPUT_TOO_LARGE"
  | "MIXED_STRUCTURE";

/**
 * A structured error for boundary failures. It deliberately carries only a code
 * and a safe message: it never embeds raw parser output, file content, or a host
 * path, so untrusted input cannot leak back through error text.
 */
export class AdapterError extends Error {
  readonly code: AdapterErrorCode;

  constructor(code: AdapterErrorCode, message: string) {
    super(message);
    this.name = "AdapterError";
    this.code = code;
  }
}
