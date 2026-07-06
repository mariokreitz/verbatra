/** Stable, machine-readable codes for a failure to start the local server. */
export type UiServerErrorCode = "PORT_IN_USE" | "BIND_FAILED";

/**
 * A structured error for a failure to start the server, so a caller can branch on {@link code}
 * instead of parsing a message. The message is always a fixed, safe string; it never embeds a
 * filesystem path or other environment detail.
 */
export class UiServerStartError extends Error {
  readonly code: UiServerErrorCode;
  readonly port: number;

  constructor(code: UiServerErrorCode, port: number, message: string) {
    super(message);
    this.name = "UiServerStartError";
    this.code = code;
    this.port = port;
  }
}
