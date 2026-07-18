import type { IntegrityGateReason } from "@verbatra/sdk";

/**
 * The settled-outcome shape shared by `translation.editEntry` and `translation.retranslateEntry`:
 * both actions resolve to success, a validation rejection (carrying which integrity check failed),
 * or an error carrying a message. `EditEntryOutcome` and `RetranslateOutcome` are each defined
 * independently, one per RPC method's `deriveXOutcome`, but are structurally this same shape, so
 * the status rendering below is written once here and reused by both `EditEntryDialog` and
 * `RetranslateButton` instead of being duplicated per component.
 */
export type SettledActionOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "rejected"; readonly reason: IntegrityGateReason }
  | { readonly kind: "error"; readonly message: string };

const REJECTION_LABEL: Readonly<Record<IntegrityGateReason, string>> = {
  placeholder: "Rejected: placeholder mismatch",
  icu: "Rejected: invalid message syntax",
  degenerate: "Rejected: degenerate translation",
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
