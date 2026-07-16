import { checkPlaceholders, type TranslationEntry } from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";

/** Why {@link gateCandidateValue} rejected a candidate value. */
export type IntegrityGateReason = "placeholder" | "icu";

/** The accept/reject decision {@link gateCandidateValue} returns. Never throws. */
export type IntegrityGateResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: IntegrityGateReason };

/**
 * The single accept/reject decision point every write path (a provider-sourced translation, a
 * workbook import row, or a human-typed edit) must call before a candidate value is merged into a
 * target resource and handed to `adapter.write`. Recomputes both checks directly from the
 * candidate value: it never trusts a provider-reported integrity map, so the same function works
 * whatever the candidate's origin.
 *
 * Runs the placeholder check first (the adapter's branch-aware `comparePlaceholders` when present,
 * otherwise `extractPlaceholders` plus core's `checkPlaceholders`), then `adapter.validateMessage`.
 * A non-ICU adapter's `validateMessage` returns true unconditionally, so the second check is only
 * ever observable for ICU-capable formats.
 *
 * @param sourceEntry - The source entry the candidate is a translation of.
 * @param candidateValue - The candidate translated value to check.
 * @param adapter - The format adapter whose placeholder and message-validity rules apply.
 * @returns The acceptance, or a rejection naming which check failed first.
 */
export function gateCandidateValue(
  sourceEntry: TranslationEntry,
  candidateValue: string,
  adapter: FormatAdapter,
): IntegrityGateResult {
  const placeholderResult =
    adapter.comparePlaceholders?.(sourceEntry.value, candidateValue) ??
    checkPlaceholders(sourceEntry.placeholders, adapter.extractPlaceholders(candidateValue));
  if (!placeholderResult.matches) {
    return { accepted: false, reason: "placeholder" };
  }
  if (!adapter.validateMessage(candidateValue)) {
    return { accepted: false, reason: "icu" };
  }
  return { accepted: true };
}
