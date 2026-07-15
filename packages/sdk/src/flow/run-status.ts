import { defaultFs, type SdkFs } from "../fs.js";
import { readRunStatusFile, runStatusFilePath } from "../run-status/run-status-file.js";
import type { RunStatusFile } from "../run-status/types.js";

/** Input for {@link runStatus}: the persisted file is self-contained, so no `config` is needed. */
export interface RunStatusInput {
  /** Directory the run-status file resolves against; defaults to cwd. */
  readonly cwd?: string;
}

/** Composition seam for {@link runStatus}: inject a file system for tests. */
export interface RunStatusDeps {
  readonly fs?: SdkFs;
}

/**
 * The persisted run-status snapshot, or its absence. `available: false` covers a project that has
 * never run a non-dry-run `translate()`/`watch()`, exactly like every other degrade case
 * {@link runStatus} folds into it: never a distinct error, so a caller does not need to special-case
 * "first run" apart from "corrupt file" apart from "unrecognized version".
 */
export type RunStatusResult =
  | { readonly available: false }
  | ({ readonly available: true } & RunStatusFile);

/**
 * Read the most recent run's persisted review-flag and token/usage snapshot from
 * `.verbatra-local/run-status.json`, without calling a provider, writing any file, or mutating the
 * lock-file. Never throws: a missing file, invalid JSON, a schema mismatch, or an unrecognized
 * `version` all degrade to `{ available: false }`, since this file is best-effort telemetry, not a
 * correctness baseline (contrast {@link lockState}, which can throw `LOCK_FILE_INVALID`).
 *
 * @param input - Only the directory the file resolves against; no config is needed.
 * @param deps - Optional composition seam (file system) for tests.
 * @returns `{ available: false }`, or `{ available: true, ...the persisted fields }`.
 */
export async function runStatus(
  input: RunStatusInput = {},
  deps: RunStatusDeps = {},
): Promise<RunStatusResult> {
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const file = await readRunStatusFile(runStatusFilePath(cwd), fs);
  if (file === undefined) {
    return { available: false };
  }
  return { available: true, ...file };
}
