import { resolve } from "node:path";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";

/** The private, non-exported local-state directory name; see `packages/cli/src/init.ts`'s `ensureGitignore`. */
const LOCAL_DIR_NAME = ".verbatra-local";

/** Options for {@link withLocaleWriteLock}. */
export interface LocaleWriteLockOptions {
  /** Base delay between acquire attempts in milliseconds, jittered on each retry. Defaults to 100. */
  readonly pollIntervalMs?: number;
  /** How long to keep retrying before throwing `LOCK_CONTENDED`. Defaults to 10 minutes. */
  readonly acquireTimeoutMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10 * 60_000;

/** The on-disk path of one locale's write lock: `<cwd>/.verbatra-local/locks/<locale>.lock`. */
export function localeLockPath(cwd: string, locale: string): string {
  return resolve(cwd, LOCAL_DIR_NAME, "locks", `${locale}.lock`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

/** Diagnostic-only payload written into a held lock file; never read back for correctness. */
function lockPayload(): string {
  return JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });
}

/**
 * Repeatedly attempt `fs.createExclusive(path, ...)` until it succeeds, sleeping a jittered
 * `pollIntervalMs` between attempts, until `deadline` (a `Date.now()`-comparable timestamp) passes.
 */
async function acquireLock(
  path: string,
  fs: SdkFs,
  pollIntervalMs: number,
  deadline: number,
): Promise<void> {
  for (;;) {
    if (await fs.createExclusive(path, lockPayload())) {
      return;
    }
    if (Date.now() >= deadline) {
      throw new SdkError(
        "LOCK_CONTENDED",
        `Could not acquire the write lock at ${path}: another process may be holding it. If no ` +
          "verbatra process is currently running, this lock file was likely left behind by one " +
          "that was killed; delete it and retry.",
      );
    }
    const jitter = Math.random() * pollIntervalMs;
    await sleep(pollIntervalMs + jitter);
  }
}

/**
 * Run `fn` while holding a real, cross-process exclusive lock scoped to exactly one
 * `(cwd, locale)` pair, so no two writers (a CLI `translate`/`watch` run, a workbook import, a
 * Studio `retranslateEntry` call, in this process or another) can ever run their read-compute-write
 * critical section for the same locale at the same time. The lock is acquired by looping
 * `fs.createExclusive` on a sidecar file at {@link localeLockPath} until it succeeds or
 * `acquireTimeoutMs` elapses (`LOCK_CONTENDED`), and released by unconditionally deleting that file
 * in a `finally`, whether `fn` resolves, rejects, or throws synchronously.
 *
 * Deliberately has no heartbeat, no stale-lock auto-reclaim, and no ownership token: a `setInterval`
 * heartbeat cannot fire while its own holder is synchronously blocked doing real work (a large
 * `adapter.write`, a big `JSON.stringify`, GC), which is exactly when a long critical section runs;
 * a waiter's staleness check could then steal a still-live holder's lock, reintroducing the lost-
 * update race this mechanism exists to close. The trade-off this accepts: a hard-killed holder
 * (`SIGKILL`, a power loss) leaves an orphaned lock file that a later run reports as
 * `LOCK_CONTENDED`, naming the exact path a person can delete; this is a liveness cost, never a
 * silent safety failure.
 *
 * Assumes a local, POSIX-like file system where `O_EXCL` exclusive create is atomic; this is not a
 * guarantee made for a network file system, out of scope for a local dev tool.
 *
 * @param cwd - Directory the lock resolves against.
 * @param locale - The locale this call locks; every caller must lock at most one locale at a time
 *   (never nested) to avoid a lock-ordering deadlock.
 * @param fs - The file system seam.
 * @param fn - The critical section to run while the lock is held.
 * @param options - Optional poll interval and acquire timeout overrides, for tests.
 * @returns Whatever `fn` resolves to.
 * @throws {@link SdkError} `LOCK_CONTENDED`: the lock could not be acquired before the timeout.
 */
export async function withLocaleWriteLock<T>(
  cwd: string,
  locale: string,
  fs: SdkFs,
  fn: () => Promise<T>,
  options: LocaleWriteLockOptions = {},
): Promise<T> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const acquireTimeoutMs = options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS;
  const path = localeLockPath(cwd, locale);

  await acquireLock(path, fs, pollIntervalMs, Date.now() + acquireTimeoutMs);
  try {
    return await fn();
  } finally {
    await fs.deleteFile(path);
  }
}
