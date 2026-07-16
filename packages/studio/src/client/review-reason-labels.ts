import type { ReviewReasonCode } from "@verbatra/sdk";

/** The four tones a review-reason chip renders with, matching Badge's existing tone set. */
export type ReviewReasonTone = "success" | "warning" | "neutral" | "danger";

/** A reason code ready to render: a distinct, human-readable label and a tone. */
export interface ReviewReasonLabelView {
  readonly label: string;
  readonly tone: ReviewReasonTone;
}

/**
 * Distinct, human-readable copy for each of the five {@link ReviewReasonCode} values, matching
 * `RetranslateButton`'s existing `REJECTION_LABEL`-style precedent: a raw code string is never
 * rendered to the user unlabeled. All five carry `warning` tone except `PROVIDER_DEGRADED`, which
 * is `neutral`: the first four are properties of the translated value itself (something a human
 * edit can directly fix), while a provider degradation is a signal about how the value was
 * produced, not a finding about the value's own content.
 */
const REVIEW_REASON_LABELS: Readonly<Record<ReviewReasonCode, ReviewReasonLabelView>> = {
  LENGTH_RATIO_OUTLIER: { label: "Unusual length", tone: "warning" },
  EQUALS_SOURCE: { label: "Matches source text", tone: "warning" },
  GLOSSARY_TERM_MISSED: { label: "Glossary term missed", tone: "warning" },
  INTEGRITY_REORDERED: { label: "Placeholders reordered", tone: "warning" },
  PROVIDER_DEGRADED: { label: "Provider degraded", tone: "neutral" },
};

/** Resolves the distinct, human-readable label and tone for one review-reason code. */
export function reviewReasonLabel(code: ReviewReasonCode): ReviewReasonLabelView {
  return REVIEW_REASON_LABELS[code];
}
