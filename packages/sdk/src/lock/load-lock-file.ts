import { defaultFs, type SdkFs } from "../fs.js";
import { lockFilePath, readLockFile } from "./lock-file.js";
import type { LockFile } from "./types.js";

export interface LoadLockFileInput {
  readonly cwd?: string;
}

export interface LoadLockFileDeps {
  readonly fs?: SdkFs;
}

export async function loadLockFile(
  input: LoadLockFileInput = {},
  deps: LoadLockFileDeps = {},
): Promise<LockFile> {
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  return readLockFile(lockFilePath(cwd), fs);
}
