import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** The file-system operations the atomic write needs, injectable so tests can force a failure at any step. */
export interface AtomicWriteOps {
  /** Create a directory and every missing parent; a no-op when it already exists. */
  mkdir(path: string): Promise<void>;
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
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
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
 * Write bytes to a target file atomically and crash-durably: create the containing directory,
 * write a temp file in it, fsync it, rename it over the target, then fsync the directory.
 *
 * The directory is created first because the target's parent may not exist yet. A locale file
 * pattern is free to put the locale in a directory rather than the filename, and the first run for
 * a new locale then has nowhere to write. Skipping this produced a raw `ENOENT` naming the hidden
 * temp sibling rather than the configured path, which is a file the user never asked for and
 * cannot find. `recursive: true` makes it a no-op in the overwhelmingly common case where the
 * directory is already there.
 *
 * Same-directory placement keeps source and destination on one filesystem so the rename is
 * atomic; a reader never sees a truncated file. The temp-file fsync happens before the rename,
 * so by the time the rename is issued its bytes are already flushed to storage; a crash after
 * that point cannot leave the target renamed-but-empty-or-garbage. A temp-write or temp-fsync
 * failure aborts before the rename, cleans up the temp best-effort, and rethrows the original fs
 * error unchanged. The directory fsync runs after a successful rename and is best-effort: its
 * failure is swallowed and never fails the call, both because the rename has already durably
 * completed the visible part of the write and because opening a directory for fsync is
 * unsupported entirely on some platforms (Windows).
 *
 * Two consequences of the temp-then-rename shape are deliberate policy, not oversights, and neither
 * should be "fixed" without revisiting the reasoning here.
 *
 * A symlinked target is **replaced, never followed**. `rename(2)` does not resolve the destination
 * symlink, so the link itself is swapped for a regular file and whatever it pointed at is left
 * untouched. That is the secure direction and the reason to keep it: resolving the target with
 * `realpath` before writing would turn a symlink planted anywhere in a checkout into an
 * arbitrary-file-write primitive, so a `verbatra translate` in CI could be steered into overwriting
 * a file outside the project. Adding an `lstat` guard would be worse than useless: there is no
 * time-of-check window today precisely because there is no check to race. If a user ever reports
 * genuinely wanting symlinked locale files to write through to a shared target, that is a product
 * decision to reopen, and it would have to place the temp file beside the *resolved* target or the
 * rename crosses filesystems and fails.
 *
 * The target's mode is **not preserved**. The rename installs a new inode carrying the temp file's
 * mode, so a target created at a restrictive mode comes back at the process umask. Locale files are
 * committed source that git resets to 0644 on checkout, and nothing written through here is a
 * credential, so preserving the mode would add a stat and a chmod to every write for no benefit.
 */
export async function atomicWriteFile(
  path: string,
  data: string,
  ops: AtomicWriteOps = nodeOps,
): Promise<void> {
  const directory = dirname(path);
  const tmp = tempFileName(path);
  try {
    await ops.mkdir(directory);
    await ops.writeFile(tmp, data);
    await ops.fsyncFile(tmp);
    await ops.rename(tmp, path);
  } catch (error) {
    await cleanup(ops, tmp);
    throw error;
  }
  try {
    await ops.fsyncDir(directory);
  } catch {}
}
