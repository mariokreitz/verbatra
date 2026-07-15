import type { ReactNode } from "react";
import { useState } from "react";
import {
  deriveRetranslateOutcome,
  type RetranslateOutcome,
} from "../client/retranslate-outcome.js";
import { rpcClient } from "./api.js";

type ButtonState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "settled"; readonly outcome: RetranslateOutcome };

const REJECTION_LABEL: Readonly<Record<"placeholder" | "icu", string>> = {
  placeholder: "Rejected: placeholder mismatch",
  icu: "Rejected: invalid message syntax",
};

function statusLabel(state: ButtonState): string {
  if (state.kind === "loading") {
    return "Retranslating…";
  }
  if (state.kind === "settled") {
    if (state.outcome.kind === "success") {
      return "Retranslated";
    }
    if (state.outcome.kind === "rejected") {
      return REJECTION_LABEL[state.outcome.reason];
    }
    return `Failed: ${state.outcome.message}`;
  }
  return "Retranslate";
}

/**
 * Per-(key, locale) retranslate action for one failing row in {@link KeyDetailDrawer}'s status
 * table. Calls `translation.retranslateEntry` for exactly this row's pair; only ever rendered by
 * the caller when both write capabilities are granted and this row currently fails integrity (see
 * `client/retranslate-eligibility.ts`). A successful call writes the target file and the lock; the
 * resulting file change reaches this drawer through the existing SSE refresh loop
 * (`useKeyIntegrity`'s own `refreshToken` dependency), not through this component re-fetching
 * anything itself.
 */
export function RetranslateButton({
  locale,
  keyName,
}: {
  readonly locale: string;
  readonly keyName: string;
}): ReactNode {
  const [state, setState] = useState<ButtonState>({ kind: "idle" });

  async function handleClick(): Promise<void> {
    setState({ kind: "loading" });
    const response = await rpcClient.call("translation.retranslateEntry", {
      locale,
      key: keyName,
    });
    setState({ kind: "settled", outcome: deriveRetranslateOutcome(response) });
  }

  const outcomeKind = state.kind === "settled" ? state.outcome.kind : undefined;

  return (
    <span className="retranslate-action">
      <button
        type="button"
        className="retranslate-button"
        disabled={state.kind === "loading"}
        onClick={() => void handleClick()}
      >
        Retranslate
      </button>
      {state.kind !== "idle" ? (
        <span
          className={
            outcomeKind === "success"
              ? "retranslate-status retranslate-status-success"
              : outcomeKind === "rejected" || outcomeKind === "error"
                ? "retranslate-status retranslate-status-error"
                : "retranslate-status"
          }
        >
          {statusLabel(state)}
        </span>
      ) : null}
    </span>
  );
}
