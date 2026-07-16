import type { SettledActionOutcome } from "../../client/settled-action-status.js";

/**
 * Every settled-action outcome this dashboard renders boils down to one of three visual states:
 * neutral (idle or still in flight), success, or failure. `EditEntryDialog`/`RetranslateButton`
 * derive this from `SettledActionOutcome` (success/rejected/error) and `RefreshToast` derives it
 * from `TranslatePendingOutcome` (success/partial-failure/error), two differently-shaped unions
 * that both collapse to the same two-way split, so the className mapping is written once here
 * against the normalized status rather than against either specific outcome shape.
 */
export type ActionStatusTone = "success" | "failure";

/**
 * Status text className for a normalized settled-action tone, or the neutral className while idle
 * or still in flight (`tone` is `undefined`). `client/settled-action-status.ts` only derives the
 * outcome's label text, not its className, so the app layer owns the Tailwind classes for this
 * shape.
 */
export function actionStatusTextClassName(tone: ActionStatusTone | undefined): string {
  if (tone === "success") {
    return "text-xs text-success";
  }
  if (tone === "failure") {
    return "text-xs text-danger";
  }
  return "text-xs text-muted-foreground";
}

/** Normalizes a `SettledActionOutcome` (success/rejected/error) to the shared two-way status tone. */
export function settledOutcomeTone(
  outcome: SettledActionOutcome | undefined,
): ActionStatusTone | undefined {
  if (outcome === undefined) {
    return undefined;
  }
  return outcome.kind === "success" ? "success" : "failure";
}
