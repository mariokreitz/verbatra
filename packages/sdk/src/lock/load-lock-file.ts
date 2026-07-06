import { defaultFs, type SdkFs } from "../fs.js";
import { lockFilePath, readLockFile } from "./lock-file.js";
import type { LockFile } from "./types.js";

/** Input for {@link loadLockFile}: the directory the lock-file resolves against. */
export interface LoadLockFileInput {
  /** Directory the lock-file resolves against; defaults to cwd. */
  readonly cwd?: string;
}

/** Composition seam for {@link loadLockFile}: inject a file system for tests. */
export interface LoadLockFileDeps {
  readonly fs?: SdkFs;
}

/**
 * Read the project's lock-file: a thin public wrapper around the internal lock-file reader,
 * following the same input/deps convention as {@link check}, {@link diff}, and {@link lockState}.
 * A missing lock-file degrades to an empty lock (first-run), the same behavior `translate` and
 * `watch` rely on internally. Callers that need to distinguish "no lock-file yet" from "an empty
 * but present lock-file" should use {@link lockState} instead, which probes the file's existence
 * explicitly.
 *
 * @param input - The directory the lock-file resolves against.
 * @param deps - Optional composition seam (file system) for tests.
 * @returns The parsed lock-file, or an empty lock when none exists yet.
 * @throws {@link SdkError} `LOCK_FILE_INVALID` when the lock-file is present but corrupt or oversized.
 */
export async function loadLockFile(
  input: LoadLockFileInput = {},
  deps: LoadLockFileDeps = {},
): Promise<LockFile> {
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  return readLockFile(lockFilePath(cwd), fs);
}
