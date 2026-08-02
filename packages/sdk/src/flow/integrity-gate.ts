import { assessValueDegeneracy, checkPlaceholders, type TranslationEntry } from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";

/** Why {@link gateCandidateValue} rejected a candidate value. */
export type IntegrityGateReason = "placeholder" | "icu" | "degenerate" | "empty";

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
 * ever observable for ICU-capable formats. Then core's `assessValueDegeneracy` rejects a
 * structurally degenerate value (a repetition loop, or a length that has run away from the source)
 * that the first two checks would otherwise wave through.
 *
 * The emptiness check runs last, and its position is deliberate. Every earlier check waves an empty
 * candidate through on its own terms: a source carrying no placeholders compares `[]` against `[]`,
 * `validateMessage("")` is true on every adapter including the ICU ones, and `assessValueDegeneracy`
 * finds no runaway repetition in a zero-length value. Running the emptiness check first would flip
 * the reported reason for a candidate that is both empty and, say, placeholder-mismatched, changing
 * a decision that is already correct; running it last leaves every existing rejection reason exactly
 * as it was and only converts today's wrongful accepts.
 *
 * An empty source keeps accepting an empty translation, so a deliberately blank string still round
 * trips. Clearing a value that does have source text is not something a translation can express; the
 * workbook's `[[CLEAR]]` sentinel is the supported way to do it, and it never reaches this gate.
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
  if (assessValueDegeneracy(sourceEntry.value, candidateValue).degenerate) {
    return { accepted: false, reason: "degenerate" };
  }
  if (sourceEntry.value.trim() !== "" && candidateValue.trim() === "") {
    return { accepted: false, reason: "empty" };
  }
  return { accepted: true };
}
