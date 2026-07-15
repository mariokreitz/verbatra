/**
 * Structured, secret-free error codes for the SDK boundaries. A key never appears in
 * any message: provider/adapter/core errors are already secret-free, and the SDK never
 * reads or holds a key. Each names a distinct boundary:
 *
 * - `CONFIG_NOT_FOUND`: no config was found by search, or an explicit `configPath` does not exist
 *   (thrown by `loadConfig`).
 * - `CONFIG_INVALID`: a config was found but is unparseable or fails validation (thrown by `loadConfig`).
 * - `UNKNOWN_FORMAT`: no adapter is registered for the configured format (thrown by `translate`).
 * - `UNKNOWN_LOCALE`: a requested locale is not among the configured target locales (thrown by
 *   `check`, `diff`, and `exportWorkbook` via the shared locale selection).
 * - `PROVIDER_CONSTRUCTION_FAILED`: the provider factory threw; wraps the provider's own error, including
 *   a missing `*_API_KEY` reported as `MISSING_API_KEY` (thrown by `translate`, non-dry-run only).
 * - `SOURCE_UNREADABLE`: the source locale file is absent (thrown by `translate`, and by `watch` at startup).
 * - `SOURCE_INVALID`: the source locale file could not be read or parsed; wraps the adapter read error
 *   (thrown by `translate`).
 * - `LOCK_FILE_INVALID`: the lock-file is present but corrupt, oversized, or at an unsupported
 *   version (thrown by `translate`, `check`, `diff`, `exportWorkbook`, `importWorkbook`, and
 *   `retranslateEntry`).
 * - `UNKNOWN_KEY`: a requested key is not among the source resource's own keys (thrown by
 *   `retranslateEntry`).
 * - `LOCK_CONTENDED`: a locale's write lock (`withLocaleWriteLock`) could not be acquired before
 *   its timeout elapsed, because another process is holding it (or an orphaned lock file was left
 *   behind by a killed process); the message names the lock file's path (thrown by `translate`,
 *   `importWorkbook`, and `retranslateEntry`).
 * - `LOCALE_FAILED` (NOT thrown): the fallback `code` recorded on a failed `LocaleSummary` when a
 *   per-locale failure carries no string code of its own. See the surfaced-not-thrown distinction on
 *   `translate`.
 */
export type SdkErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "UNKNOWN_FORMAT"
  | "UNKNOWN_LOCALE"
  | "UNKNOWN_KEY"
  | "PROVIDER_CONSTRUCTION_FAILED"
  | "SOURCE_UNREADABLE"
  | "SOURCE_INVALID"
  | "LOCK_FILE_INVALID"
  | "LOCK_CONTENDED"
  | "LOCALE_FAILED";

/** The single structured error the SDK throws or records. Never carries a secret. */
export class SdkError extends Error {
  /** The stable {@link SdkErrorCode} for this failure; branch on this, not the message. */
  readonly code: SdkErrorCode;

  /**
   * @param code - The stable failure code.
   * @param message - A fixed, secret-free message; the SDK never holds a key to put here.
   */
  constructor(code: SdkErrorCode, message: string) {
    super(message);
    this.name = "SdkError";
    this.code = code;
  }
}
