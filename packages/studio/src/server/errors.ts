/** Stable, machine-readable codes for a failure to start the local server. */
export type StudioServerErrorCode = "PORT_IN_USE" | "BIND_FAILED";

/**
 * A structured error for a failure to start the server, so a caller can branch on {@link code}
 * instead of parsing a message. The message is always a fixed, safe string; it never embeds a
 * filesystem path or other environment detail.
 */
export class StudioServerStartError extends Error {
  readonly code: StudioServerErrorCode;
  readonly port: number;

  constructor(code: StudioServerErrorCode, port: number, message: string) {
    super(message);
    this.name = "StudioServerStartError";
    this.code = code;
    this.port = port;
  }
}
