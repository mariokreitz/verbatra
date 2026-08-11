import type { WatchRunResult } from "@verbatra/sdk";
import type { RenderableError } from "./render.js";

/**
 * The `--json` envelope contract: every record the CLI writes to stdout under `--json` is one of
 * these two shapes, serialized as a single line.
 *
 * Success and failure share the `ok` discriminator, the `command` that produced the record, and the
 * `version` of this envelope, so a caller can branch on one field and never has to guess which
 * command's payload it is holding. Before this envelope existed, a whole-run failure left stdout
 * empty and the only machine-usable signal was the exit code.
 *
 * What stays where does not change: the human-readable error line, progress records, and lock-wait
 * records all remain on stderr, so stdout carries nothing but envelopes.
 *
 * @packageDocumentation
 */

/**
 * The version of the envelope shape itself, not the package version. It is an integer rather than a
 * semver string so a consumer can compare it with `===` or `<` and is never tempted to range-parse
 * it. Bump it only when an existing field changes meaning or disappears; adding a new field does not
 * require a bump, so consumers must ignore fields they do not know.
 */
export const JSON_ENVELOPE_VERSION = 1;

/** The `--json` record for a command that produced a result. */
export interface SuccessEnvelope<TResult> {
  /** Always `true`; the discriminator to branch on. */
  readonly ok: true;
  /** {@link JSON_ENVELOPE_VERSION}. */
  readonly version: number;
  /** The subcommand that produced this record, for example `"check"`. */
  readonly command: string;
  /** The command's own payload, unchanged from what it used to print bare. */
  readonly result: TResult;
}

/**
 * The `--json` record for a failure. Carries the same stable, secret-free `code` and `message` the
 * stderr line renders, so a caller branches on the identical vocabulary in either mode.
 */
export interface ErrorEnvelope {
  /** Always `false`; the discriminator to branch on. */
  readonly ok: false;
  /** {@link JSON_ENVELOPE_VERSION}. */
  readonly version: number;
  /** The subcommand that failed, or `null` when the failure happened before one was resolved. */
  readonly command: string | null;
  /** The stable error code (an SDK error code, a CLI usage code, or `"CLI_ERROR"`). */
  readonly code: string;
  /** The one-line, secret-free message; never a stack. */
  readonly message: string;
}

/**
 * Serializes a success record as one line of JSON.
 *
 * `JSON.stringify` escapes any newline inside a string value as `\n`, so the returned line never
 * contains an embedded line break: callers append exactly one trailing newline and the stream stays
 * one-record-per-line.
 *
 * @param command - The subcommand name, for example `"translate"`.
 * @param result - The command's payload, nested under `result` rather than spread, so the envelope's
 *   own fields can never collide with a payload field.
 * @returns The single-line JSON record (no trailing newline).
 */
export function renderSuccessEnvelope<TResult>(command: string, result: TResult): string {
  const envelope: SuccessEnvelope<TResult> = {
    ok: true,
    version: JSON_ENVELOPE_VERSION,
    command,
    result,
  };
  return JSON.stringify(envelope);
}

/**
 * Serializes a failure record as one line of JSON. The projection is the same secret-free
 * `{ code, message }` the stderr line uses, so the envelope can carry no key the stderr line would
 * not have carried.
 *
 * @param command - The subcommand name, or `null` when none was resolved.
 * @param error - The structured error projection.
 * @returns The single-line JSON record (no trailing newline).
 */
export function renderErrorEnvelope(command: string | null, error: RenderableError): string {
  const envelope: ErrorEnvelope = {
    ok: false,
    version: JSON_ENVELOPE_VERSION,
    command,
    code: error.code,
    message: error.message,
  };
  return JSON.stringify(envelope);
}

/**
 * One `watch --json` NDJSON record: the same envelope every other command emits, so a consumer
 * parses each line of the stream exactly as it parses a one-shot command's single line.
 *
 * A succeeded run carries its `RunSummary` under `result`, matching `translate --json` byte for
 * byte apart from the `command` value. A failed run becomes an {@link ErrorEnvelope}: watch keeps
 * running after a failed run, so the stream continues rather than terminating, and the record's
 * `ok: false` is what marks that one run as failed. The former `status` field is dropped because
 * `ok` already carries it.
 *
 * @param result - The outcome of one watch run.
 * @returns The single-line JSON record (one NDJSON line, no trailing newline).
 */
export function renderRunResultEnvelope(result: WatchRunResult): string {
  return result.status === "succeeded"
    ? renderSuccessEnvelope("watch", result.summary)
    : renderErrorEnvelope("watch", result.error);
}
