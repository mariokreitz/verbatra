import type { RpcResultFor } from "../shared/rpc/contract.js";

/** One locale's pending-change entry from a `status.diff` result: the three key lists per locale. */
export type DiffLocale = RpcResultFor<"status.diff">["locales"][number];

/** The four states a key can be in for one locale, derived from that locale's three key lists. */
export type KeyLocaleStatus = "missing" | "changed" | "orphaned" | "in-sync";

/** One locale's derived status for a single key, ready to render. */
export interface KeyLocaleStatusRow {
  readonly locale: string;
  readonly status: KeyLocaleStatus;
}

function statusForLocale(locale: DiffLocale, key: string): KeyLocaleStatus {
  if (locale.missing.includes(key)) {
    return "missing";
  }
  if (locale.changed.includes(key)) {
    return "changed";
  }
  if (locale.orphaned.includes(key)) {
    return "orphaned";
  }
  return "in-sync";
}

/**
 * Derives one key's status per locale from an already-loaded `status.diff` result: a key present
 * in none of a locale's missing, changed, or orphaned lists is in sync for that locale. Never
 * fetches anything itself; the caller supplies the locales it already has (the Diff panel's own
 * loaded state), so selecting a key never triggers a second network round trip.
 */
export function deriveKeyLocaleStatus(
  locales: readonly DiffLocale[],
  key: string,
): readonly KeyLocaleStatusRow[] {
  return locales.map((locale) => ({ locale: locale.locale, status: statusForLocale(locale, key) }));
}

/**
 * True when every checked locale has empty missing, changed, and orphaned lists: nothing at all
 * pending or worth reviewing. Deliberately not the same as a `hasPendingChanges: false` result,
 * which ignores orphaned keys by design (see the sdk's own diff summary): a project with only
 * orphaned keys must still show them, not the all-clear success state.
 */
export function isFullyInSync(locales: readonly DiffLocale[]): boolean {
  return locales.every(
    (locale) =>
      locale.missing.length === 0 && locale.changed.length === 0 && locale.orphaned.length === 0,
  );
}
