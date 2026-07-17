import type { RpcResultFor } from "../shared/rpc/contract.js";
import type { RpcCallResult } from "./rpc-client.js";
import type { FetchOutcome } from "./state.js";

/** The three counts a locale's coverage percentage is computed from. */
export interface LocaleCoverageCounts {
  readonly missing: number;
  readonly stale: number;
  readonly upToDate: number;
}

/** One locale row, ready to render: the sdk's own counts plus the derived percentage. */
export interface StatusRow extends LocaleCoverageCounts {
  readonly locale: string;
  readonly percent: number;
  readonly inSync: boolean;
}

/** The Status panel's own data shape: overall sync state plus one row per locale. */
export interface StatusData {
  readonly inSync: boolean;
  readonly rows: readonly StatusRow[];
}

/**
 * Coverage percentage for one locale: `upToDate / (missing + stale + upToDate)`, rounded to the
 * nearest whole percent. A zero-key source project has a denominator of zero; that locale always
 * renders as 100, never `NaN` or `Infinity`.
 */
export function coveragePercent(counts: LocaleCoverageCounts): number {
  const total = counts.missing + counts.stale + counts.upToDate;
  if (total === 0) {
    return 100;
  }
  return Math.round((counts.upToDate / total) * 100);
}

/**
 * Mean coverage across every locale row, rounded to the nearest whole percent, for the Status
 * panel's summary tile. An empty row list (a project with no target locales) reads 100, matching
 * {@link coveragePercent}'s own zero-denominator convention: nothing exists to be behind.
 */
export function averageCoverage(rows: readonly StatusRow[]): number {
  if (rows.length === 0) {
    return 100;
  }
  return Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / rows.length);
}

/** How many locale rows are currently out of sync, for the Status panel's summary tile. */
export function outOfSyncCount(rows: readonly StatusRow[]): number {
  return rows.filter((row) => !row.inSync).length;
}

/** Maps a successful `status.check` result to {@link StatusData}: each locale gets its computed percentage. */
export function toStatusData(result: RpcResultFor<"status.check">): StatusData {
  const rows = result.locales.map((locale) => ({ ...locale, percent: coveragePercent(locale) }));
  return { inSync: result.inSync, rows };
}

/**
 * Maps one `status.check` rpc outcome to the generic {@link FetchOutcome} shape
 * `applyRefreshOutcome` (see `client/state.ts`) expects, so the Status panel's stale-data
 * behavior goes through that one covered reducer instead of a second, panel-local
 * reimplementation of the same keep-last-good-data decision.
 */
export function toStatusOutcome(response: RpcCallResult<"status.check">): FetchOutcome<StatusData> {
  if (!response.ok) {
    return { ok: false, error: response.error };
  }
  return { ok: true, result: toStatusData(response.result) };
}
