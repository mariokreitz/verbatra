export type StudioServerErrorCode = "PORT_IN_USE" | "BIND_FAILED";

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
