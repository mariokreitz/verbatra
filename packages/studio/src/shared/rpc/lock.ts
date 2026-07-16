import { z } from "zod";

/** The RPC method name for the read-only lock-drift view. */
export const LOCK_STATE_METHOD = "lock.state";

/** Takes no parameters: the lock state always reflects the single loaded project's lock-file. */
export const lockStateParamsSchema = z.strictObject({});

/** Parsed `lock.state` params. */
export type LockStateParams = z.infer<typeof lockStateParamsSchema>;

/** Per-locale key count and drift against the source and target files, from the recorded lock baseline. */
export interface LockLocaleState {
  readonly locale: string;
  readonly keyCount: number;
  readonly missing: number;
  readonly stale: number;
  readonly upToDate: number;
}

/**
 * The lock-file's existence, version, and per-locale drift. `exists` comes from an explicit
 * probe of the lock-file path, never from a read that degrades a missing file to an empty lock,
 * so "no lock-file yet" and "an empty but present lock-file" stay distinguishable.
 */
export type LockStateResult =
  | { readonly exists: false }
  | {
      readonly exists: true;
      readonly version: number;
      readonly locales: readonly LockLocaleState[];
    };
