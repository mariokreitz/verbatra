import { ProviderError } from "../errors.js";
import { translationsResultSchema } from "./schema.js";

/**
 * The outcome of reconciling a parsed response against the requested keys: the well-formed
 * translations that are safe to accept this round, and the keys still needing another attempt.
 */
export interface ReconcileOutcome {
  /** Requested keys present exactly once with the correct shape; safe to accept as-is. */
  readonly accepted: Map<string, string>;
  /**
   * Requested keys not accepted this round: missing from the response entirely, or present more
   * than once (ambiguous, so neither copy is accepted). Candidates for a bounded repair round.
   */
  readonly missingKeys: readonly string[];
}

interface RawTranslation {
  readonly key: string;
  readonly value: string;
}

/**
 * Split raw translations into first-seen values and the set of keys seen more than once. Any key
 * outside the requested set is a hallucination and fails the whole batch immediately: unlike a
 * missing or duplicated key, there is no safe partial-accept around invented content.
 */
function partitionTranslations(
  translations: readonly RawTranslation[],
  requested: ReadonlySet<string>,
): { readonly firstSeen: Map<string, string>; readonly duplicated: Set<string> } {
  const firstSeen = new Map<string, string>();
  const duplicated = new Set<string>();
  for (const { key, value } of translations) {
    if (!requested.has(key)) {
      throw new ProviderError("INVALID_RESPONSE", "The provider returned an unexpected key.");
    }
    if (firstSeen.has(key)) {
      duplicated.add(key);
      continue;
    }
    firstSeen.set(key, value);
  }
  return { firstSeen, duplicated };
}

/**
 * Reconcile a parsed response against the requested keys with bounded partial-accept: a hallucinated
 * (unrequested) key still fails the whole batch immediately, but a missing or duplicated key is
 * partitioned into {@link ReconcileOutcome.missingKeys} instead of failing the batch, so the caller can
 * accept the well-formed remainder and repair only the offending keys.
 */
function reconcile(
  translations: readonly RawTranslation[],
  requestedKeys: readonly string[],
): ReconcileOutcome {
  const requested = new Set(requestedKeys);
  const { firstSeen, duplicated } = partitionTranslations(translations, requested);
  const missingKeys = requestedKeys.filter((key) => duplicated.has(key) || !firstSeen.has(key));
  for (const key of duplicated) {
    firstSeen.delete(key);
  }
  return { accepted: firstSeen, missingKeys };
}

/**
 * The single validation boundary for every LLM provider: the raw output is validated against the
 * canonical schema, then reconciled with the requested keys using bounded partial-accept (see
 * {@link reconcile}). Output is treated strictly as data, never executed or interpreted.
 *
 * @param raw - The mechanism's unparsed per-key output.
 * @param requestedKeys - The keys the response should contain, at most once each.
 * @returns The well-formed accepted translations plus the keys still missing or duplicated.
 * @throws {@link ProviderError} `INVALID_RESPONSE`: the payload is malformed, or contains a key that was
 *   never requested (a hallucination, always a hard failure).
 */
export function reconcileResult(raw: unknown, requestedKeys: readonly string[]): ReconcileOutcome {
  const parsed = translationsResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "The provider returned a malformed translation payload.",
    );
  }
  return reconcile(parsed.data.translations, requestedKeys);
}
