import type { PlaceholderIntegrityResult } from "@verbatra/core";
import type { ProviderNotice, ReviewFlag, ReviewReasonCode } from "./provider.js";

/** Below this ratio, the translation is suspiciously short relative to the source. */
const LENGTH_RATIO_MIN = 0.35;
/** Above this ratio, the translation is suspiciously long relative to the source. */
const LENGTH_RATIO_MAX = 3.0;
/** A trimmed source shorter than this (in UTF-16 code units) never trips the length-ratio check. */
const LENGTH_RATIO_MIN_SOURCE_LENGTH = 12;

/** Matches any Unicode letter, used to distinguish a translatable source from a placeholder/numeric/punctuation-only one. */
const UNICODE_LETTER = /\p{L}/u;

/** The two provider-notice codes that mean a batch was gracefully degraded. */
const DEGRADATION_NOTICE_CODES: ReadonlySet<ProviderNotice["code"]> = new Set([
  "FORMALITY_DOWNGRADED",
  "GLOSSARY_IGNORED",
]);

/**
 * Plain-data input for {@link computeReviewFlags}: one key's source and translated value, its
 * locales, its placeholder-integrity result, and the optional glossary. No provider client, no
 * request object, no I/O, so both a provider's `translateBatch` and the SDK's export path can call
 * the identical function.
 */
export interface ReviewFlagInput {
  /** The source-locale value. */
  readonly sourceValue: string;
  /** The translated (or current-target, at export time) value. */
  readonly translatedValue: string;
  /** BCP-47 source locale, used only to detect an untranslated (equals-source) value. */
  readonly sourceLocale: string;
  /** BCP-47 target locale, used only to detect an untranslated (equals-source) value. */
  readonly targetLocale: string;
  /** The placeholder-integrity result already computed for this key. */
  readonly integrity: PlaceholderIntegrityResult;
  /** Optional source-term to target-term glossary map; skipped entirely when absent or empty. */
  readonly glossary?: Readonly<Record<string, string>> | undefined;
}

/**
 * A translation whose length is far shorter or longer than its source. Advisory only: it can
 * over-flag a legitimately verbose target language (German) or a dense CJK target. Skipped for a
 * very short source, where the ratio is not meaningful.
 */
function isLengthRatioOutlier(sourceValue: string, translatedValue: string): boolean {
  const trimmedSource = sourceValue.trim();
  if (trimmedSource.length < LENGTH_RATIO_MIN_SOURCE_LENGTH) {
    return false;
  }
  const ratio = translatedValue.trim().length / trimmedSource.length;
  return ratio < LENGTH_RATIO_MIN || ratio > LENGTH_RATIO_MAX;
}

/**
 * A translation identical to its source, in a different locale, where the source actually had
 * something translatable (at least one Unicode letter). A placeholder-only, numeric-only, or
 * punctuation-only source is never flagged this way.
 */
function isEqualsSource(input: ReviewFlagInput): boolean {
  const trimmedSource = input.sourceValue.trim();
  const trimmedTranslated = input.translatedValue.trim();
  return (
    trimmedTranslated === trimmedSource &&
    input.targetLocale !== input.sourceLocale &&
    UNICODE_LETTER.test(trimmedSource)
  );
}

/** Whether any configured glossary term found in the source is missing from the translation. */
function isGlossaryTermMissed(input: ReviewFlagInput): boolean {
  const glossary = input.glossary;
  if (glossary === undefined || Object.keys(glossary).length === 0) {
    return false;
  }
  const sourceLower = input.sourceValue.toLowerCase();
  const translatedLower = input.translatedValue.toLowerCase();
  for (const [sourceTerm, targetTerm] of Object.entries(glossary)) {
    const sourceHit = sourceLower.includes(sourceTerm.toLowerCase());
    const targetHit = translatedLower.includes(targetTerm.toLowerCase());
    if (sourceHit && !targetHit) {
      return true;
    }
  }
  return false;
}

/** A matched placeholder set that landed in a different order than the source. */
function isIntegrityReordered(integrity: PlaceholderIntegrityResult): boolean {
  return integrity.matches && integrity.reordered;
}

/**
 * Compute the derived review reasons for one key from plain values. Pure and provider-independent:
 * called both at translate time (by `runLlmTranslation` and the DeepL provider) and at export time
 * (by the SDK's `export-workbook.ts`), so the two paths can never drift. `PROVIDER_DEGRADED` is
 * never produced here; see {@link applyProviderDegraded}.
 *
 * @param input - The key's source/translated values, locales, integrity result, and glossary.
 * @returns A {@link ReviewFlag} carrying every reason that applies, or `undefined` when none do
 *   (an absent map entry means "ok").
 */
export function computeReviewFlags(input: ReviewFlagInput): ReviewFlag | undefined {
  const reasons: ReviewReasonCode[] = [];
  if (isLengthRatioOutlier(input.sourceValue, input.translatedValue)) {
    reasons.push("LENGTH_RATIO_OUTLIER");
  }
  if (isEqualsSource(input)) {
    reasons.push("EQUALS_SOURCE");
  }
  if (isGlossaryTermMissed(input)) {
    reasons.push("GLOSSARY_TERM_MISSED");
  }
  if (isIntegrityReordered(input.integrity)) {
    reasons.push("INTEGRITY_REORDERED");
  }
  return reasons.length > 0 ? { status: "review", reasons } : undefined;
}

/**
 * Apply `PROVIDER_DEGRADED` to every accepted key of a batch that carried a `FORMALITY_DOWNGRADED`
 * or `GLOSSARY_IGNORED` notice, adding it to an existing flag's reasons or creating a new flag entry.
 * Caller-side by design: this derives from a provider notice, a fact the pure per-key function above
 * has no access to. A no-op (returns `reviewFlags` unchanged) when no degradation notice is present.
 *
 * @param reviewFlags - The flags already computed for this batch (from {@link computeReviewFlags}).
 * @param notices - The batch's provider notices.
 * @param acceptedKeys - Every key accepted from this batch.
 * @returns The updated map; the input map is never mutated.
 */
export function applyProviderDegraded(
  reviewFlags: ReadonlyMap<string, ReviewFlag>,
  notices: readonly ProviderNotice[],
  acceptedKeys: readonly string[],
): ReadonlyMap<string, ReviewFlag> {
  if (!notices.some((notice) => DEGRADATION_NOTICE_CODES.has(notice.code))) {
    return reviewFlags;
  }
  const next = new Map(reviewFlags);
  for (const key of acceptedKeys) {
    const existing = next.get(key);
    next.set(key, {
      status: "review",
      reasons:
        existing !== undefined ? [...existing.reasons, "PROVIDER_DEGRADED"] : ["PROVIDER_DEGRADED"],
    });
  }
  return next;
}
