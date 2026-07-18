import { resolve } from "node:path";
import { SdkError } from "../errors.js";
import type { BoundedFileRead, SdkFs } from "../fs.js";

/** The private, non-exported local-state directory name; see `packages/cli/src/init.ts`'s `ensureGitignore`. */
const LOCAL_DIR_NAME = ".verbatra-local";

/**
 * The file-name stem of the shared lock-file guard (see {@link withLockFileGuard}). Prefixed with
 * an underscore, which no real BCP-47 locale tag ever starts with, so it can never collide with a
 * locale's own lock file.
 */
const LOCK_FILE_GUARD_STEM = "_lockfile";

/** Diagnostic details, read leniently from a held lock file, about the process currently holding it. */
export interface LockHolder {
  /** The holder's process id, when the lock file could be read and carried a numeric `pid`. */
  readonly pid?: number;
  /** The holder's acquire time as an ISO-8601 string, when the lock file carried a string `acquiredAt`. */
  readonly acquiredAt?: string;
}

/** One wait-progress notification emitted while an acquire is blocked on a held lock. */
export interface LockWaitEvent {
  /** The on-disk path of the contended lock file, the exact path a person can delete if it is orphaned. */
  readonly lockPath: string;
  /** Milliseconds elapsed since this acquire started waiting, for a "still waiting" progress line. */
  readonly elapsedMs: number;
  /**
   * Diagnostics about the holding process, present only when the lock file could be read and parsed.
   * Purely for messaging; never consulted for any acquire decision.
   */
  readonly holder?: LockHolder;
}

/** Called while an acquire is blocked, to surface wait progress; the lock module itself writes no output. */
export type LockWaitListener = (event: LockWaitEvent) => void;

/** Options shared by {@link withLocaleWriteLock} and {@link withLockFileGuard}. */
export interface LocaleWriteLockOptions {
  /** Base delay between acquire attempts in milliseconds, jittered on each retry. Defaults to 100. */
  readonly pollIntervalMs?: number;
  /** How long to keep retrying before throwing `LOCK_CONTENDED`. Defaults to 10 minutes. */
  readonly acquireTimeoutMs?: number;
  /**
   * Invoked while an acquire is blocked on a lock another process holds: once right after the first
   * failed attempt (carrying the holder diagnostics when the lock file is readable), then at most once
   * per {@link WAIT_NOTICE_INTERVAL_MS} of continued waiting (carrying the growing elapsed time). Never
   * called for an uncontended acquire. The lock module emits no output of its own; a caller (the CLI)
   * uses this to render a "still waiting" line.
   */
  readonly onWait?: LockWaitListener;
}

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10 * 60_000;

/** Smallest gap between successive {@link LockWaitListener} notifications after the first, to avoid spam. */
const WAIT_NOTICE_INTERVAL_MS = 1_000;

/** Upper bound on the tiny diagnostic lock payload read for {@link LockHolder}; a real payload is well under this. */
const MAX_LOCK_PAYLOAD_BYTES = 64 * 1_024;

function lockPath(cwd: string, stem: string): string {
  return resolve(cwd, LOCAL_DIR_NAME, "locks", `${stem}.lock`);
}

/** The on-disk path of one locale's write lock: `<cwd>/.verbatra-local/locks/<locale>.lock`. */
export function localeLockPath(cwd: string, locale: string): string {
  return lockPath(cwd, locale);
}

/** The on-disk path of the shared lock-file guard; see {@link withLockFileGuard}. */
export function lockFileGuardPath(cwd: string): string {
  return lockPath(cwd, LOCK_FILE_GUARD_STEM);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

/**
 * Diagnostic-only payload written into a held lock file. Parsed back leniently by {@link parseHolder}
 * to describe the holder in wait messaging; never read back for an acquire decision or any correctness.
 */
function lockPayload(): string {
  return JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });
}

/**
 * Parse a held lock file's diagnostic payload leniently into a {@link LockHolder}. Returns `undefined`
 * when the file is unreadable or not valid JSON; a valid-but-partial payload yields a holder with only
 * the fields whose types matched. Never throws: the payload is for messaging only, never correctness.
 */
function parseHolder(read: BoundedFileRead): LockHolder | undefined {
  if (read.kind !== "ok") {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.content);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const record = parsed as Record<string, unknown>;
  const holder: { pid?: number; acquiredAt?: string } = {};
  if (typeof record.pid === "number") {
    holder.pid = record.pid;
  }
  if (typeof record.acquiredAt === "string") {
    holder.acquiredAt = record.acquiredAt;
  }
  return holder;
}

/**
 * Build the per-acquire wait notifier: reads the holder diagnostics once (lazily, on the first failed
 * attempt) and caches them, then emits an event on that first call and thereafter only once the elapsed
 * wait has grown by at least {@link WAIT_NOTICE_INTERVAL_MS}, so a long wait produces a steady, low-rate
 * progress stream rather than one event per poll.
 */
function makeWaitNotifier(
  path: string,
  fs: SdkFs,
  onWait: LockWaitListener,
  start: number,
): () => Promise<void> {
  let holder: LockHolder | undefined;
  let holderRead = false;
  let lastEmit: number | undefined;
  return async (): Promise<void> => {
    if (!holderRead) {
      holderRead = true;
      holder = parseHolder(await fs.readFileBounded(path, MAX_LOCK_PAYLOAD_BYTES));
    }
    const elapsedMs = Date.now() - start;
    if (lastEmit !== undefined && elapsedMs - lastEmit < WAIT_NOTICE_INTERVAL_MS) {
      return;
    }
    lastEmit = elapsedMs;
    onWait({ lockPath: path, elapsedMs, ...(holder !== undefined ? { holder } : {}) });
  };
}

/**
 * Repeatedly attempt `fs.createExclusive(path, ...)` until it succeeds, sleeping a jittered
 * `pollIntervalMs` between attempts, until `deadline` (a `Date.now()`-comparable timestamp) passes.
 * When `notify` is supplied, it runs after each failed attempt to surface wait progress.
 */
async function acquireLock(
  path: string,
  fs: SdkFs,
  pollIntervalMs: number,
  deadline: number,
  notify?: () => Promise<void>,
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
    if (notify !== undefined) {
      await notify();
    }
    const jitter = Math.random() * pollIntervalMs;
    await sleep(pollIntervalMs + jitter);
  }
}

/**
 * Run `fn` while holding a real, cross-process exclusive lock at `path`: acquired by looping
 * `fs.createExclusive` until it succeeds or `acquireTimeoutMs` elapses (`LOCK_CONTENDED`), released
 * by unconditionally deleting the lock file in a `finally`, whether `fn` resolves, rejects, or
 * throws synchronously. The shared primitive behind both {@link withLocaleWriteLock} and
 * {@link withLockFileGuard}.
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
 */
async function withFileLock<T>(
  path: string,
  fs: SdkFs,
  fn: () => Promise<T>,
  options: LocaleWriteLockOptions,
): Promise<T> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const acquireTimeoutMs = options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS;
  const start = Date.now();
  const notify =
    options.onWait !== undefined ? makeWaitNotifier(path, fs, options.onWait, start) : undefined;

  await acquireLock(path, fs, pollIntervalMs, start + acquireTimeoutMs, notify);
  try {
    return await fn();
  } finally {
    await fs.deleteFile(path);
  }
}

/**
 * Run `fn` while holding a real, cross-process exclusive lock scoped to exactly one
 * `(cwd, locale)` pair, so no two writers (a CLI `translate`/`watch` run, a workbook import, a
 * Studio `retranslateEntry` call, in this process or another) can ever run their read-compute-write
 * critical section for the same locale's target file and lock-file subtree at the same time. See
 * {@link withFileLock} for the underlying acquire/release mechanism.
 *
 * A locale's lock protects only that locale's own subtree; it does not by itself serialize access
 * to the single shared lock-file two different locales' critical sections both eventually write to.
 * `updateLockFileLocale` closes that separate gap with its own, much shorter-lived
 * {@link withLockFileGuard}, nested inside whichever locale lock the caller holds; a caller of this
 * function never needs to think about that second lock directly.
 *
 * @param cwd - Directory the lock resolves against.
 * @param locale - The locale this call locks; every caller must lock at most one locale at a time
 *   (never nested) to avoid a lock-ordering deadlock.
 * @param fs - The file system seam.
 * @param fn - The critical section to run while the lock is held.
 * @param options - Optional poll interval, acquire-timeout override (surfaced to the CLI as
 *   `--lock-timeout`), and an `onWait` wait-progress listener (the CLI's "still waiting" line).
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
  return withFileLock(localeLockPath(cwd, locale), fs, fn, options);
}

/**
 * Run `fn` while holding a real, cross-process exclusive lock guarding the single, physical
 * lock-file (`verbatra.lock.json`) itself, independent of which locale's content lock the caller
 * already holds. `withLocaleWriteLock` serializes writers only for the *same* locale; two different
 * locales' critical sections are, by design, allowed to run fully concurrently (an unrelated locale
 * is never blocked by another). But both eventually read-modify-write the one shared lock-file to
 * update their own subtree within it, and that read-modify-write is itself a race between any two
 * concurrently-running locales' critical sections unless it is separately serialized. This guard is
 * that separate serialization: `updateLockFileLocale` is its only caller, holding it only for the
 * duration of its own read-modify-write step (never across a provider call), so it stays a leaf lock
 * with no risk of contributing to a long critical section.
 *
 * Always acquired from inside an already-held `withLocaleWriteLock` call and always released before
 * that outer lock is released (nesting order: locale lock outer, this guard inner, consistently, at
 * every call site), so there is no lock-ordering cycle between the two.
 *
 * @param cwd - Directory the lock resolves against.
 * @param fs - The file system seam.
 * @param fn - The critical section to run while the guard is held (the lock-file's own read-write).
 * @param options - Optional poll interval, acquire-timeout, and `onWait` wait-progress overrides.
 * @returns Whatever `fn` resolves to.
 * @throws {@link SdkError} `LOCK_CONTENDED`: the guard could not be acquired before the timeout.
 */
export async function withLockFileGuard<T>(
  cwd: string,
  fs: SdkFs,
  fn: () => Promise<T>,
  options: LocaleWriteLockOptions = {},
): Promise<T> {
  return withFileLock(lockFileGuardPath(cwd), fs, fn, options);
}
