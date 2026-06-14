import { rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/**
 * The file-system operations the atomic write needs, injectable so tests can force a
 * failure at the temp-write, rename, or cleanup step without touching the real disk path.
 * Production uses the node:fs/promises bindings below.
 */
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

/**
 * Best-effort temp removal that must NEVER mask the original failure: its own error is
 * swallowed so the caller observes the real temp-write/rename error, not a cleanup error.
 */
async function cleanup(ops: AtomicWriteOps, tmp: string): Promise<void> {
  try {
    await ops.rm(tmp);
  } catch {
    // Swallowed on purpose: a cleanup failure must not shadow the original fs error.
  }
}

/**
 * Write bytes to a target file atomically: write to a temp file in the SAME directory as
 * the target, then rename it over the target. The temp must be same-directory so source
 * and destination share a filesystem; rename is atomic only then, so a reader sees either
 * the complete old file or the complete new file, never a truncated middle, and an
 * interrupted write leaves the prior target intact. On any failure the temp is cleaned up
 * (best effort) and the ORIGINAL fs error propagates unchanged — no structured wrapping.
 */
export async function atomicWriteFile(
  path: string,
  data: string,
  ops: AtomicWriteOps = nodeOps,
): Promise<void> {
  const tmp = join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${Date.now()}`);
  try {
    await ops.writeFile(tmp, data);
    await ops.rename(tmp, path);
  } catch (error) {
    await cleanup(ops, tmp);
    throw error;
  }
}
