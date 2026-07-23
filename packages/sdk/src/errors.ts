/**
 * Structured, secret-free error codes for the SDK boundaries. A key never appears in
 * any message: provider/adapter/core errors are already secret-free, and the SDK never
 * reads or holds a key. Each names a distinct boundary:
 *
 * - `CONFIG_NOT_FOUND`: no config was found by search, or an explicit `configPath` does not exist
 *   (thrown by `loadConfig`).
 * - `CONFIG_INVALID`: a config was found but is unparseable or fails validation, or its glossary
 *   file path could not be resolved (thrown by `loadConfig`).
 * - `UNKNOWN_FORMAT`: no adapter is registered for the configured format (thrown by every entry
 *   point that selects an adapter, before any file is read).
 * - `UNKNOWN_LOCALE`: a requested locale is not among the configured target locales (thrown via
 *   the shared locale selection by `check`, `diff`, `keyIntegrity`, `lockState`, `exportWorkbook`,
 *   `keyValue`, `editEntry`, and `retranslateEntry`).
 * - `UNKNOWN_KEY`: a requested key is not among the source resource's own keys (thrown by
 *   `keyValue`, `editEntry`, and `retranslateEntry`).
 * - `PROVIDER_CONSTRUCTION_FAILED`: the provider factory threw; wraps the provider's own error,
 *   including a missing `*_API_KEY` reported as `MISSING_API_KEY` (thrown by non-dry-run
 *   `translate` and by `retranslateEntry`).
 * - `SOURCE_UNREADABLE`: the source locale file is absent (thrown by every entry point that reads
 *   the source, and by `watch` at startup).
 * - `SOURCE_INVALID`: the source locale file could not be read or parsed; wraps the adapter read
 *   error (thrown by every entry point that reads the source).
 * - `LOCK_FILE_INVALID`: the lock-file is present but corrupt, oversized, or at an unsupported
 *   version (thrown wherever the lock-file is read or updated: `translate`, `check`, `diff`,
 *   `keyIntegrity`, `lockState`, `loadLockFile`, `exportWorkbook`, `importWorkbook`, `editEntry`,
 *   and `retranslateEntry`).
 * - `LOCK_CONTENDED`: a locale's write lock (`withLocaleWriteLock`) could not be acquired before
 *   its timeout elapsed, because another process is holding it (or an orphaned lock file was left
 *   behind by a killed process); the message names the lock file's path (thrown by `translate`,
 *   `importWorkbook`, `editEntry`, and `retranslateEntry`).
 * - `CONCURRENCY_INVALID`: the `concurrency` input is not an integer of at least 1 (thrown by
 *   `translate` and, per run, by `watch`, before any locale runs).
 * - `CONCURRENCY_BUDGET_CONFLICT`: a live run requested `concurrency` greater than 1 while a token
 *   budget (`maxTokens`) is configured; the two are mutually exclusive because concurrency makes the
 *   budget's stop guarantee nondeterministic (thrown by `translate` before any provider call; a dry
 *   run is exempt, since it never folds usage into or consults the budget tracker, so the conflict
 *   cannot arise).
 * - `LOCALE_FAILED` (NOT thrown): the fallback `code` recorded on a failed `LocaleSummary` when a
 *   per-locale failure carries no string code of its own. See the surfaced-not-thrown distinction
 *   on `translate`.
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
  | "CONCURRENCY_INVALID"
  | "CONCURRENCY_BUDGET_CONFLICT"
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
