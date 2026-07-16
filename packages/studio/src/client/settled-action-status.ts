/**
 * The settled-outcome shape shared by `translation.editEntry` and `translation.retranslateEntry`:
 * both actions resolve to success, a validation rejection (with the same two reasons), or an
 * error carrying a message. `EditEntryOutcome` and `RetranslateOutcome` are each defined
 * independently, one per RPC method's `deriveXOutcome`, but are structurally this same shape, so
 * the status rendering below is written once here and reused by both `EditEntryDialog` and
 * `RetranslateButton` instead of being duplicated per component.
 */
export type SettledActionOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "rejected"; readonly reason: "placeholder" | "icu" }
  | { readonly kind: "error"; readonly message: string };

const REJECTION_LABEL: Readonly<Record<"placeholder" | "icu", string>> = {
  placeholder: "Rejected: placeholder mismatch",
  icu: "Rejected: invalid message syntax",
};

/**
 * Renders a settled outcome's status text. `successLabel` covers the one word that differs
 * between callers ("Saved" for an edit, "Retranslated" for a retranslate).
 */
export function settledActionStatusLabel(
  outcome: SettledActionOutcome,
  successLabel: string,
): string {
  if (outcome.kind === "success") {
    return successLabel;
  }
  if (outcome.kind === "rejected") {
    return REJECTION_LABEL[outcome.reason];
  }
  return `Failed: ${outcome.message}`;
}

/**
 * Renders the status span's className for a settled outcome, or the neutral className when no
 * outcome has settled yet (`undefined`, e.g. while idle or still in flight).
 */
export function settledActionStatusClassName(outcome: SettledActionOutcome | undefined): string {
  if (outcome?.kind === "success") {
    return "retranslate-status retranslate-status-success";
  }
  if (outcome?.kind === "rejected" || outcome?.kind === "error") {
    return "retranslate-status retranslate-status-error";
  }
  return "retranslate-status";
}
