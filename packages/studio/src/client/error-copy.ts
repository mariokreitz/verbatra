import type { StructuredError } from "./state.js";

/**
 * Codes reachable through Studio's RPC surface regardless of capability flags, mapped to
 * specific, actionable copy:
 *
 * - Transport-level, from `server/rpc-gate.ts` and `client/rpc-client.ts`.
 * - `SdkErrorCode` values thrown by the sdk calls Studio's RPC handlers make (see
 *   `@verbatra/sdk`'s `errors.ts`). `UNKNOWN_KEY` is reachable through `translation.editEntry`,
 *   `translation.retranslateEntry`, and `key.value`, all three of which re-read the source
 *   resource on every call. `LOCK_CONTENDED` is reachable through `translation.editEntry` and
 *   `translation.retranslateEntry`, the two methods that hold a target locale's write lock.
 * - `AdapterErrorCode` values (see `@verbatra/format-adapters`'s `errors.ts`), reachable only when
 *   a target locale file fails to parse; a source-file failure is always wrapped as the sdk's own
 *   `SOURCE_INVALID` before it can reach the client.
 *
 * A code that reaches the client without an entry in the merged table (for example
 * `ALREADY_IN_PROGRESS`, or a provider code not listed below) falls back to the server's
 * structured `error.message` via {@link resolveErrorCopy}.
 */
const REACHABLE_CODE_COPY: Readonly<Record<string, string>> = {
  REQUEST_INVALID:
    "The request body was not shaped as the server expects. Reload the page and try again.",
  METHOD_UNKNOWN:
    "This action is not recognized by the running Studio server. Make sure the CLI and Studio versions match.",
  PARAMS_INVALID: "The request parameters failed validation. Reload the page and try again.",
  INTERNAL: "An unexpected server error occurred. Check the terminal running Studio for details.",
  SESSION_EXPIRED: "The session has expired. Reload the page to start a new one.",
  UNKNOWN_FORMAT:
    "No adapter is registered for this project's configured format. Check the format field in the verbatra config.",
  SOURCE_UNREADABLE: "The source locale file could not be found on disk.",
  SOURCE_INVALID: "The source locale file could not be read or parsed for the configured format.",
  LOCK_FILE_INVALID: "The lock file is missing, corrupt, or at an unsupported version.",
  UNKNOWN_LOCALE: "The requested locale is not among this project's configured target locales.",
  UNKNOWN_KEY: "The requested key was not found in the source resource. It may have been removed.",
  LOCK_CONTENDED:
    "This locale's write lock is held by another process. Wait a moment and try again.",
  INVALID_JSON: "A target locale file is not valid JSON.",
  INVALID_YAML: "A target locale file is not valid YAML.",
  INVALID_XML: "A target locale file is not valid XML.",
  INVALID_STRUCTURE: "A target locale file has a structure that is not valid for its format.",
  MAX_DEPTH_EXCEEDED: "A target locale file is nested deeper than the supported limit.",
  INPUT_TOO_LARGE: "A target locale file exceeds the supported size limit.",
  MIXED_STRUCTURE:
    "A target locale file mixes flat and nested keys, which this format does not support.",
};

/**
 * Copy for three `ProviderErrorCode` values (see `@verbatra/ai-providers`'s `errors.ts` for the
 * canonical codes; Studio never imports that package, so the code strings are duplicated here
 * rather than referenced by type). These reach the client on a spend-enabled server:
 * `translation.retranslateEntry` and `translation.translatePending` call a provider, and
 * `server/rpc-gate.ts`'s `mapHandlerError` forwards a thrown `ProviderError`'s own code and
 * redacted message. The remaining provider codes have no entry and fall back to the server's
 * message.
 *
 * Note: the server's per-method rate limiter answers HTTP 429 with the same `RATE_LIMITED` code
 * string, so that transport-level rejection also resolves to this provider-worded copy.
 */
const FORWARD_LOOKING_CODE_COPY: Readonly<Record<string, string>> = {
  RATE_LIMITED: "The translation provider is rate-limiting requests. Wait a moment and try again.",
  AUTH_FAILED: "The translation provider rejected the configured API key.",
  TIMEOUT: "The translation provider did not respond in time. Try again.",
};

/** The complete code-to-copy lookup table: the transport, sdk, and adapter codes plus the three provider codes. */
export const ERROR_CODE_COPY: Readonly<Record<string, string>> = {
  ...REACHABLE_CODE_COPY,
  ...FORWARD_LOOKING_CODE_COPY,
};

/**
 * The specific copy for a known error code, or `undefined` when the code is not in the table.
 * Guarded with `Object.hasOwn` rather than a bare index lookup: `error.code` is server-controlled
 * but not statically narrowed to the table's keys by the time it reaches this function, and an
 * unguarded lookup would resolve an `Object.prototype` member name (for example `"constructor"` or
 * `"toString"`) to that inherited value instead of falling back to the generic message.
 */
export function copyForErrorCode(code: string): string | undefined {
  return Object.hasOwn(ERROR_CODE_COPY, code) ? ERROR_CODE_COPY[code] : undefined;
}

/**
 * Resolves the text an error should render as: specific, actionable copy for a known code, or,
 * for any code not in the table, exactly `error.message` unchanged, the same generic text
 * rendered before this lookup existed. Never returns a raw stack trace or an unmapped internal
 * object: `error.message` is already secret-free, structured text by the time it reaches the
 * client (see `server/redaction.ts`), so the fallback is safe by construction, not by escaping.
 */
export function resolveErrorCopy(error: StructuredError): string {
  return copyForErrorCode(error.code) ?? error.message;
}
