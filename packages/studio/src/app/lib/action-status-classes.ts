import type { SettledActionOutcome } from "../../client/settled-action-status.js";

export type ActionStatusTone = "success" | "failure";

export function actionStatusTextClassName(tone: ActionStatusTone | undefined): string {
  if (tone === "success") {
    return "text-xs text-success";
  }
  if (tone === "failure") {
    return "text-xs text-danger";
  }
  return "text-xs text-muted-foreground";
}

export function settledOutcomeTone(
  outcome: SettledActionOutcome | undefined,
): ActionStatusTone | undefined {
  if (outcome === undefined) {
    return undefined;
  }
  return outcome.kind === "success" ? "success" : "failure";
}
