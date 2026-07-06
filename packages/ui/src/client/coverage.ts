import type { RpcCallResult } from "./rpc-client.js";

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

/** The Status panel's own render state, derived from one `status.check` call. */
export type StatusView =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loaded"; readonly inSync: boolean; readonly rows: readonly StatusRow[] };

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
 * Maps one `status.check` rpc outcome to the Status panel's render state, without touching the
 * DOM: a domain error carries its message through unchanged (the panel renders it in place, the
 * rest of the shell stays intact); a success maps each locale to a {@link StatusRow} with its
 * coverage percentage attached.
 */
export function deriveStatusView(response: RpcCallResult<"status.check">): StatusView {
  if (!response.ok) {
    return { kind: "error", message: response.error.message };
  }
  const rows = response.result.locales.map((locale) => ({
    ...locale,
    percent: coveragePercent(locale),
  }));
  return { kind: "loaded", inSync: response.result.inSync, rows };
}
