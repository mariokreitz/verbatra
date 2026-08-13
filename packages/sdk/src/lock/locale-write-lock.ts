import { resolve } from "node:path";
import { SdkError } from "../errors.js";
import type { BoundedFileRead, SdkFs } from "../fs.js";

const LOCAL_DIR_NAME = ".verbatra-local";

const LOCK_FILE_GUARD_STEM = "_lockfile";

export interface LockHolder {
  readonly pid?: number;
  readonly acquiredAt?: string;
}

export interface LockWaitEvent {
  readonly lockPath: string;
  readonly elapsedMs: number;
  readonly holder?: LockHolder;
}

export type LockWaitListener = (event: LockWaitEvent) => void;

export interface LocaleWriteLockOptions {
  readonly pollIntervalMs?: number;
  readonly acquireTimeoutMs?: number;
  readonly onWait?: LockWaitListener;
}

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10 * 60_000;

const WAIT_NOTICE_INTERVAL_MS = 1_000;

const MAX_LOCK_PAYLOAD_BYTES = 64 * 1_024;

function lockPath(cwd: string, stem: string): string {
  return resolve(cwd, LOCAL_DIR_NAME, "locks", `${stem}.lock`);
}

export function localeLockPath(cwd: string, locale: string): string {
  return lockPath(cwd, locale);
}

export function lockFileGuardPath(cwd: string): string {
  return lockPath(cwd, LOCK_FILE_GUARD_STEM);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

function lockPayload(): string {
  return JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });
}

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
    if (notify !== undefined) {
      await notify();
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

export async function withLocaleWriteLock<T>(
  cwd: string,
  locale: string,
  fs: SdkFs,
  fn: () => Promise<T>,
  options: LocaleWriteLockOptions = {},
): Promise<T> {
  return withFileLock(localeLockPath(cwd, locale), fs, fn, options);
}

export async function withLockFileGuard<T>(
  cwd: string,
  fs: SdkFs,
  fn: () => Promise<T>,
  options: LocaleWriteLockOptions = {},
): Promise<T> {
  return withFileLock(lockFileGuardPath(cwd), fs, fn, options);
}
