import type { ReactNode } from "react";
import { useState } from "react";
import {
  deriveRetranslateOutcome,
  type RetranslateOutcome,
} from "../client/retranslate-outcome.js";
import { settledActionStatusLabel } from "../client/settled-action-status.js";
import { rpcClient } from "./api.js";
import { Button } from "./Button.js";
import { actionStatusTextClassName, settledOutcomeTone } from "./lib/action-status-classes.js";

type ButtonState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "settled"; readonly outcome: RetranslateOutcome };

function statusLabel(state: ButtonState): string {
  if (state.kind === "loading") {
    return "Retranslating…";
  }
  if (state.kind === "settled") {
    return settledActionStatusLabel(state.outcome, "Retranslated");
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

  return (
    <span className="ms-2 inline-flex items-center gap-2">
      <Button disabled={state.kind === "loading"} onClick={() => void handleClick()}>
        Retranslate
      </Button>
      {state.kind !== "idle" ? (
        <span
          className={actionStatusTextClassName(
            settledOutcomeTone(state.kind === "settled" ? state.outcome : undefined),
          )}
        >
          {statusLabel(state)}
        </span>
      ) : null}
    </span>
  );
}
