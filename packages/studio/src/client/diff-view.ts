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

/**
 * The full set of keys that have any drift in at least one checked locale: the union of missing,
 * changed, and orphaned key names across every locale in `locales`, deduplicated and sorted.
 *
 * This is deliberately not the full set of keys that exist. `check()` reports counts only, never
 * key names, and `diff()` reports only keys that have drift in at least one locale; a key that is
 * fully in sync everywhere never appears in any of the three lists for any locale, so it is not
 * reconstructable from the RPC surface Studio already has. Getting the complete key universe
 * (drift-free keys included) would need a new RPC method exposing the full synced key set, which
 * is out of scope here. The grid this feeds therefore rows only drift-affected keys, by design:
 * a fully in-sync key never gets a row, not because it was missed.
 */
export function driftKeys(locales: readonly DiffLocale[]): readonly string[] {
  const keys = new Set<string>();
  for (const locale of locales) {
    for (const key of locale.missing) {
      keys.add(key);
    }
    for (const key of locale.changed) {
      keys.add(key);
    }
    for (const key of locale.orphaned) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}
