import type { SettledActionOutcome } from "../../client/settled-action-status.js";

/**
 * The normalized visual tone of a settled action. Different outcome unions
 * collapse to the same two-way split, so the className mapping is written
 * once against this tone rather than against each specific outcome shape.
 */
export type ActionStatusTone = "success" | "failure";

/**
 * Status text className for a normalized settled-action tone, or the neutral
 * className when `tone` is undefined (idle or still in flight).
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

/** Normalizes a `SettledActionOutcome` to the shared two-way status tone; undefined passes through. */
export function settledOutcomeTone(
  outcome: SettledActionOutcome | undefined,
): ActionStatusTone | undefined {
  if (outcome === undefined) {
    return undefined;
  }
  return outcome.kind === "success" ? "success" : "failure";
}
