import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** The file-system operations the atomic write needs, injectable so tests can force a failure at any step. */
export interface AtomicWriteOps {
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string): Promise<void>;
}

const nodeOps: AtomicWriteOps = {
  writeFile: (path, data) => writeFile(path, data, "utf8"),
  rename: (from, to) => rename(from, to),
  rm: (path) => rm(path, { force: true }),
};

async function cleanup(ops: AtomicWriteOps, tmp: string): Promise<void> {
  try {
    await ops.rm(tmp);
  } catch {
    // Swallowed on purpose: a cleanup failure must not shadow the original fs error.
  }
}

/**
 * Build a collision-proof temp-file name: a hidden sibling of the target in the same directory.
 * The random UUID keeps two writes to the same target in the same millisecond from colliding.
 */
export function tempFileName(path: string): string {
  return join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`);
}

/**
 * Write bytes to a target file atomically by writing a temp file in the same directory and
 * renaming it over the target. Same-directory placement keeps source and destination on one
 * filesystem so the rename is atomic; a reader never sees a truncated file. On failure the temp
 * is cleaned up best-effort and the original fs error propagates unchanged.
 */
export async function atomicWriteFile(
  path: string,
  data: string,
  ops: AtomicWriteOps = nodeOps,
): Promise<void> {
  const tmp = tempFileName(path);
  try {
    await ops.writeFile(tmp, data);
    await ops.rename(tmp, path);
  } catch (error) {
    await cleanup(ops, tmp);
    throw error;
  }
}
