import { randomUUID } from "node:crypto";
import { open, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** The file-system operations the atomic write needs, injectable so tests can force a failure at any step. */
export interface AtomicWriteOps {
  writeFile(path: string, data: string): Promise<void>;
  fsyncFile(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  fsyncDir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
}

async function fsyncPath(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Fsync a directory, swallowing any failure. Best-effort by design: a directory cannot be opened
 * for fsync at all on some platforms (Windows), and the visible part of the write (the rename) has
 * already durably completed by the time this runs, so a failure here must never fail the call.
 */
async function fsyncDirBestEffort(path: string): Promise<void> {
  try {
    await fsyncPath(path);
  } catch {}
}

const nodeOps: AtomicWriteOps = {
  writeFile: (path, data) => writeFile(path, data, "utf8"),
  fsyncFile: (path) => fsyncPath(path),
  rename: (from, to) => rename(from, to),
  fsyncDir: (path) => fsyncDirBestEffort(path),
  rm: (path) => rm(path, { force: true }),
};

/** Remove the temp file, swallowing any failure so it never shadows the original fs error. */
async function cleanup(ops: AtomicWriteOps, tmp: string): Promise<void> {
  try {
    await ops.rm(tmp);
  } catch {}
}

/**
 * Build a collision-proof temp-file name: a hidden sibling of the target in the same directory.
 * The random UUID keeps two writes to the same target in the same millisecond from colliding.
 */
export function tempFileName(path: string): string {
  return join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`);
}

/**
 * Write bytes to a target file atomically and crash-durably: write a temp file in the same
 * directory, fsync it, rename it over the target, then fsync the containing directory.
 * Same-directory placement keeps source and destination on one filesystem so the rename is
 * atomic; a reader never sees a truncated file. The temp-file fsync happens before the rename,
 * so by the time the rename is issued its bytes are already flushed to storage; a crash after
 * that point cannot leave the target renamed-but-empty-or-garbage. A temp-write or temp-fsync
 * failure aborts before the rename, cleans up the temp best-effort, and rethrows the original fs
 * error unchanged. The directory fsync runs after a successful rename and is best-effort: its
 * failure is swallowed and never fails the call, both because the rename has already durably
 * completed the visible part of the write and because opening a directory for fsync is
 * unsupported entirely on some platforms (Windows).
 */
export async function atomicWriteFile(
  path: string,
  data: string,
  ops: AtomicWriteOps = nodeOps,
): Promise<void> {
  const tmp = tempFileName(path);
  try {
    await ops.writeFile(tmp, data);
    await ops.fsyncFile(tmp);
    await ops.rename(tmp, path);
  } catch (error) {
    await cleanup(ops, tmp);
    throw error;
  }
  try {
    await ops.fsyncDir(dirname(path));
  } catch {}
}
