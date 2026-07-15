import type { StructuredError } from "./state.js";

/**
 * Codes reachable today through Studio's read-only RPC surface, mapped to specific, actionable
 * copy. Every code here can actually reach the client:
 *
 * - Transport-level, from `server/rpc-gate.ts` and `client/rpc-client.ts`.
 * - `SdkErrorCode` values reachable via `check()`, `diff()`, and `lockState()`, the only three sdk
 *   calls any Studio RPC handler makes (see `@verbatra/sdk`'s `errors.ts`). `CONFIG_NOT_FOUND`,
 *   `CONFIG_INVALID`, `PROVIDER_CONSTRUCTION_FAILED`, and `LOCALE_FAILED` are real `SdkErrorCode`
 *   values but are thrown only by `loadConfig` or `translate`, neither of which any Studio RPC
 *   handler calls, so they are excluded here.
 * - `AdapterErrorCode` values (see `@verbatra/format-adapters`'s `errors.ts`), reachable only when
 *   a target locale file fails to parse; a source-file failure is always wrapped as the sdk's own
 *   `SOURCE_INVALID` before it can reach the client.
 */
const REACHABLE_CODE_COPY: Readonly<Record<string, string>> = {
  // Transport-level.
  REQUEST_INVALID:
    "The request body was not shaped as the server expects. Reload the page and try again.",
  METHOD_UNKNOWN:
    "This action is not recognized by the running Studio server. Make sure the CLI and Studio versions match.",
  PARAMS_INVALID: "The request parameters failed validation. Reload the page and try again.",
  INTERNAL: "An unexpected server error occurred. Check the terminal running Studio for details.",
  SESSION_EXPIRED: "The session has expired. Reload the page to start a new one.",
  // SdkErrorCode.
  UNKNOWN_FORMAT:
    "No adapter is registered for this project's configured format. Check the format field in the verbatra config.",
  SOURCE_UNREADABLE: "The source locale file could not be found on disk.",
  SOURCE_INVALID: "The source locale file could not be read or parsed for the configured format.",
  LOCK_FILE_INVALID: "The lock file is missing, corrupt, or at an unsupported version.",
  UNKNOWN_LOCALE: "The requested locale is not among this project's configured target locales.",
  // AdapterErrorCode: reachable only for a target locale file, never the source file.
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
 * Forward-looking entries for `ProviderErrorCode`-style failures (see `@verbatra/ai-providers`'s
 * `errors.ts` for the canonical codes; Studio never imports that package, so the three code
 * strings are duplicated here rather than referenced by type). None of these can be emitted
 * today: Studio's six RPC handlers never construct or call a translation provider (see
 * `server/rpc-gate.ts`'s `mapHandlerError`, which recognizes only `SdkError` and `AdapterError` by
 * name; anything else falls through to a fixed, generic `INTERNAL`). Kept here, dormant, so a
 * future write path that does call a provider (still blocked on a separate gated-write decision)
 * gets specific copy for free instead of the generic fallback.
 */
const FORWARD_LOOKING_CODE_COPY: Readonly<Record<string, string>> = {
  RATE_LIMITED: "The translation provider is rate-limiting requests. Wait a moment and try again.",
  AUTH_FAILED: "The translation provider rejected the configured API key.",
  TIMEOUT: "The translation provider did not respond in time. Try again.",
};

/** The complete code-to-copy lookup table: every reachable-today code plus the three dormant, forward-looking ones. */
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
