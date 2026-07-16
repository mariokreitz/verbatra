import type { ReactNode } from "react";
import { useState } from "react";
import { canTranslatePending, type RefreshToastView } from "../client/refresh-toast.js";
import {
  deriveTranslatePendingOutcome,
  type TranslatePendingOutcome,
} from "../client/translate-pending-outcome.js";
import { rpcClient } from "./api.js";
import { Button } from "./Button.js";
import { actionStatusTextClassName } from "./lib/action-status-classes.js";
import { Toast } from "./Toast.js";
import { useCapabilities } from "./use-capabilities.js";

type ActionState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "settled"; readonly outcome: TranslatePendingOutcome };

function actionStatusLabel(state: ActionState): string {
  if (state.kind === "loading") {
    return "Translating…";
  }
  if (state.kind === "settled") {
    if (state.outcome.kind === "success") {
      return "Translated";
    }
    if (state.outcome.kind === "partial-failure") {
      return `Failed for ${state.outcome.failedLocales.join(", ")}`;
    }
    return `Failed: ${state.outcome.message}`;
  }
  return "";
}

function actionStatusClassName(state: ActionState): string {
  if (state.kind !== "settled") {
    return actionStatusTextClassName(undefined);
  }
  return actionStatusTextClassName(state.outcome.kind === "success" ? "success" : "failure");
}

export interface RefreshToastProps {
  readonly view: RefreshToastView;
  readonly onDismiss: () => void;
}

/**
 * Renders one toast slot for a live-refresh event: a category label and a nonzero-delta summary,
 * always; a "translate pending changes across all locales" action only when
 * `client/refresh-toast.ts`'s `canTranslatePending` says both the toast (source-reason, nonzero
 * delta) and the write capabilities allow it; and a dismiss control that clears the slot without
 * ever calling the action. Follows the same idle/loading/settled state machine
 * `RetranslateButton.tsx` already uses, adapted for `TranslatePendingOutcome`'s three-armed shape
 * (success, a partial failure naming which locales, or a transport/domain error) instead of that
 * component's two-armed accepted/rejected one.
 */
export function RefreshToast({ view, onDismiss }: RefreshToastProps): ReactNode {
  const [state, setState] = useState<ActionState>({ kind: "idle" });
  const capabilitiesState = useCapabilities();
  const capabilities =
    capabilitiesState.kind === "loaded" ? capabilitiesState.capabilities : undefined;
  const showAction = canTranslatePending(view.actionEligible, capabilities);

  async function handleClick(): Promise<void> {
    setState({ kind: "loading" });
    const response = await rpcClient.call("translation.translatePending", {});
    setState({ kind: "settled", outcome: deriveTranslatePendingOutcome(response) });
  }

  return (
    <Toast>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{view.label}</span>
        <span className="text-sm text-muted-foreground">{view.summary}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showAction ? (
          <Button
            variant="primary"
            disabled={state.kind === "loading"}
            onClick={() => void handleClick()}
          >
            Translate pending changes across all locales
          </Button>
        ) : null}
        {state.kind !== "idle" ? (
          <span className={actionStatusClassName(state)}>{actionStatusLabel(state)}</span>
        ) : null}
        <Button
          variant="ghost"
          className="ms-auto text-base leading-none"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </Button>
      </div>
    </Toast>
  );
}
