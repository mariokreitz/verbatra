/**
 * Structured, secret-free error codes for the SDK boundaries. A key never appears in
 * any message: provider/adapter/core errors are already secret-free, and the SDK never
 * reads or holds a key.
 */
export type SdkErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "UNKNOWN_FORMAT"
  | "PROVIDER_CONSTRUCTION_FAILED"
  | "SOURCE_UNREADABLE"
  | "SOURCE_INVALID"
  | "LOCK_FILE_INVALID"
  | "LOCALE_FAILED";

/** The single structured error the SDK throws or records. Never carries a secret. */
export class SdkError extends Error {
  readonly code: SdkErrorCode;

  constructor(code: SdkErrorCode, message: string) {
    super(message);
    this.name = "SdkError";
    this.code = code;
  }
}
