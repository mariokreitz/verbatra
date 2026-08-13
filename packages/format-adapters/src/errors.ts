export type AdapterErrorCode =
  | "INVALID_JSON"
  | "INVALID_YAML"
  | "INVALID_XML"
  | "INVALID_STRUCTURE"
  | "MAX_DEPTH_EXCEEDED"
  | "INPUT_TOO_LARGE"
  | "MIXED_STRUCTURE";

export class AdapterError extends Error {
  readonly code: AdapterErrorCode;

  constructor(code: AdapterErrorCode, message: string) {
    super(message);
    this.name = "AdapterError";
    this.code = code;
  }
}
