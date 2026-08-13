import { defaultFs, type SdkFs } from "../fs.js";
import { readRunStatusFile, runStatusFilePath } from "../run-status/run-status-file.js";
import type { RunStatusFile } from "../run-status/types.js";

export interface RunStatusInput {
  readonly cwd?: string;
}

export interface RunStatusDeps {
  readonly fs?: SdkFs;
}

export type RunStatusResult =
  | { readonly available: false }
  | ({ readonly available: true } & RunStatusFile);

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
