/**
 * The stable, structured failure codes the SDK throws. Branch on {@link SdkError.code} rather than
 * on a message; the messages are written for humans and are not part of the contract.
 *
 * A code never carries a secret. API keys are read from the environment by the providers alone, so
 * the SDK never holds one, and provider, adapter, and core errors are secret-free before the SDK
 * wraps them.
 *
 * - `CONFIG_NOT_FOUND`: no config file was found by search, or an explicit `configPath` does not
 *   exist. Thrown by {@link loadConfig} and {@link loadConfigWithMeta}.
 * - `CONFIG_INVALID`: a config was found but is unparseable or fails validation, or its glossary
 *   file could not be resolved or parsed. Thrown by {@link loadConfig} and
 *   {@link loadConfigWithMeta}, and also by {@link importWorkbook} when a handoff sheet or file
 *   names a locale that is not a configured target locale.
 * - `UNKNOWN_FORMAT`: no adapter is registered for the configured format. Thrown by every entry
 *   point that selects an adapter, before any file is read.
 * - `UNKNOWN_LOCALE`: a requested locale is not among the configured target locales. Thrown through
 *   the shared locale selection by {@link check}, {@link diff}, {@link keyIntegrity},
 *   {@link lockState}, {@link exportWorkbook}, {@link keyValue}, {@link editEntry}, and
 *   {@link retranslateEntry}.
 * - `UNKNOWN_KEY`: the requested key is not present in the source resource. Thrown by
 *   {@link keyValue}, {@link editEntry}, and {@link retranslateEntry}.
 * - `PROVIDER_CONSTRUCTION_FAILED`: the provider factory threw. Wraps the provider's own error,
 *   including a missing `*_API_KEY` environment variable. Thrown by a non-dry-run
 *   {@link translate} and by {@link retranslateEntry}.
 * - `SOURCE_UNREADABLE`: the source locale file is absent. Thrown by every entry point that reads
 *   the source, by {@link watch} at startup, and by {@link importWorkbook} when the handoff file
 *   itself is missing.
 * - `SOURCE_INVALID`: the source locale file, or an interchange file, could not be parsed. Wraps
 *   the adapter or reader error.
 * - `LOCK_FILE_INVALID`: the lock-file exists but is corrupt, oversized, or at an unsupported
 *   version. Thrown wherever the lock-file is read or updated: {@link translate}, {@link check},
 *   {@link diff}, {@link keyIntegrity}, {@link lockState}, {@link loadLockFile},
 *   {@link exportWorkbook}, {@link importWorkbook}, {@link editEntry}, and
 *   {@link retranslateEntry}.
 * - `LOCK_CONTENDED`: a locale's write lock could not be acquired before its timeout elapsed,
 *   because another process holds it or a killed process left the lock file behind. The message
 *   names the lock file's path. Thrown by {@link translate}, {@link importWorkbook},
 *   {@link editEntry}, and {@link retranslateEntry}.
 * - `LOCALE_LAYOUT_INVALID`: the configured `files.pattern` and `files.localeStyle` cannot be
 *   combined, or the style has no valid path spelling for a configured locale. Thrown by
 *   {@link createLocalePathResolver}, and so by every entry point that maps a locale to a path,
 *   before any file is read and before any provider call.
 * - `LOCALE_PATH_COLLISION`: two configured locales resolve to the same absolute path, which would
 *   make the path-to-locale direction ambiguous and let two locale workers race on one file. Thrown
 *   at the same point as `LOCALE_LAYOUT_INVALID`.
 * - `CONCURRENCY_INVALID`: the `concurrency` input is not an integer of at least 1. Thrown by
 *   {@link translate}, and per run by {@link watch}, before any locale runs.
 * - `CONCURRENCY_BUDGET_CONFLICT`: a live run requested a `concurrency` above 1 while a token
 *   budget is configured. The two are mutually exclusive because concurrency makes the budget's
 *   stop guarantee nondeterministic. A dry run is exempt, since it never consults the budget.
 * - `LOCALE_FAILED`: never thrown. It is the fallback code recorded on a failed
 *   {@link LocaleSummary} when a per-locale failure carries no code of its own.
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
  | "LOCALE_LAYOUT_INVALID"
  | "LOCALE_PATH_COLLISION"
  | "CONCURRENCY_INVALID"
  | "CONCURRENCY_BUDGET_CONFLICT"
  | "LOCALE_FAILED";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
}

export function describeError(
  error: unknown,
  fallbackCode: string,
): { code: string; message: string } {
  return { code: stringCode(error) ?? fallbackCode, message: errorMessage(error) };
}

/**
 * The single structured error the SDK throws. Every whole-run failure surfaces as an `SdkError`
 * carrying a stable {@link SdkErrorCode}; per-locale failures, provider notices, and integrity
 * findings are reported as data on the {@link RunSummary} instead of being thrown.
 *
 * An `SdkError` never carries a secret in its message.
 */
export class SdkError extends Error {
  /** The stable {@link SdkErrorCode} for this failure. Branch on this, not on the message. */
  readonly code: SdkErrorCode;

  /**
   * @param code - The stable failure code.
   * @param message - A human-readable description of the failure. Never contains a secret.
   */
  constructor(code: SdkErrorCode, message: string) {
    super(message);
    this.name = "SdkError";
    this.code = code;
  }
}
