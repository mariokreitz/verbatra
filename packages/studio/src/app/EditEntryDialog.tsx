import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { deriveEditEntryOutcome, type EditEntryOutcome } from "../client/edit-entry-outcome.js";
import { deriveKeyValueContext, type KeyValueContext } from "../client/key-value-context.js";
import { rpcClient } from "./api.js";
import { useDialogA11y } from "./use-dialog-a11y.js";

const REJECTION_LABEL: Readonly<Record<"placeholder" | "icu", string>> = {
  placeholder: "Rejected: placeholder mismatch",
  icu: "Rejected: invalid message syntax",
};

type SubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting" }
  | { readonly kind: "settled"; readonly outcome: EditEntryOutcome };

export interface EditEntryDialogProps {
  readonly locale: string;
  readonly keyName: string;
  readonly onClose: () => void;
  /** Called once, only on a genuine acceptance; the caller marks the row actioned and may close the dialog. */
  readonly onAccepted: (locale: string, keyName: string) => void;
}

/**
 * Fetches `key.value`'s current source and target once per (locale, keyName) pair, feeding the
 * editor's pre-population. The response-to-state mapping itself lives in the covered, pure
 * `deriveKeyValueContext` (`client/key-value-context.ts`); this hook only owns the fetch effect.
 */
function useKeyValueContext(locale: string, keyName: string): KeyValueContext {
  const [state, setState] = useState<KeyValueContext>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    void rpcClient.call("key.value", { locale, key: keyName }).then((response) => {
      if (!cancelled) {
        setState(deriveKeyValueContext(response));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locale, keyName]);

  return state;
}

function submitStatusLabel(state: SubmitState): string {
  if (state.kind === "submitting") {
    return "Saving…";
  }
  if (state.kind === "settled") {
    if (state.outcome.kind === "success") {
      return "Saved";
    }
    if (state.outcome.kind === "rejected") {
      return REJECTION_LABEL[state.outcome.reason];
    }
    return `Failed: ${state.outcome.message}`;
  }
  return "";
}

function submitStatusClassName(state: SubmitState): string {
  const kind = state.kind === "settled" ? state.outcome.kind : undefined;
  if (kind === "success") {
    return "retranslate-status retranslate-status-success";
  }
  if (kind === "rejected" || kind === "error") {
    return "retranslate-status retranslate-status-error";
  }
  return "retranslate-status";
}

function EditorFields({
  context,
  value,
  onChangeValue,
  disabled,
}: {
  readonly context: Extract<KeyValueContext, { kind: "loaded" }>;
  readonly value: string;
  readonly onChangeValue: (next: string) => void;
  readonly disabled: boolean;
}): ReactNode {
  return (
    <>
      <section className="panel-section">
        <h3>Source</h3>
        <p className="panel-intro mono">{context.source}</p>
      </section>
      <section className="panel-section">
        <h3>Translation</h3>
        {context.target === undefined ? (
          <p className="empty-state-inline">No translation exists yet for this locale.</p>
        ) : null}
        <textarea
          className="filter-input"
          aria-label={`Translation for ${context.source}`}
          value={value}
          onChange={(event) => onChangeValue(event.target.value)}
          disabled={disabled}
          rows={4}
        />
      </section>
    </>
  );
}

/**
 * Inline or modal editor for one needs-review row: opens by calling `key.value` to pre-populate
 * the editor with the key's current source and target before the translator types anything
 * (acceptance criterion 6), submits through `translation.editEntry`. On acceptance, calls
 * `onAccepted`; the caller (the Review panel) marks the row actioned in the session overlay. On
 * rejection, reuses the same rejection-label UX pattern `RetranslateButton` already established,
 * not a new one. Reuses `useDialogA11y` for the focus trap and Esc-to-close, matching
 * `KeyDetailDrawer`'s own precedent.
 */
export function EditEntryDialog({
  locale,
  keyName,
  onClose,
  onAccepted,
}: EditEntryDialogProps): ReactNode {
  const context = useKeyValueContext(locale, keyName);
  const [value, setValue] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  useEffect(() => {
    if (context.kind === "loaded") {
      setValue(context.target ?? "");
    }
  }, [context]);

  async function handleSubmit(): Promise<void> {
    setSubmit({ kind: "submitting" });
    const response = await rpcClient.call("translation.editEntry", {
      locale,
      key: keyName,
      value,
    });
    const outcome = deriveEditEntryOutcome(response);
    setSubmit({ kind: "settled", outcome });
    if (outcome.kind === "success") {
      onAccepted(locale, keyName);
    }
  }

  return (
    <div className="drawer-backdrop">
      <button
        type="button"
        className="drawer-backdrop-dismiss"
        onClick={onClose}
        aria-label={`Close the editor for ${keyName}`}
      />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${keyName} in ${locale}`}
        ref={containerRef}
      >
        <div className="drawer-header">
          <h2 className="drawer-title mono">
            {keyName} <span className="empty-state-inline">({locale})</span>
          </h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        {context.kind === "loading" ? <p className="panel-intro">Loading current value…</p> : null}
        {context.kind === "error" ? <p className="panel-intro">{context.message}</p> : null}
        {context.kind === "loaded" ? (
          <>
            <EditorFields
              context={context}
              value={value}
              onChangeValue={setValue}
              disabled={submit.kind === "submitting"}
            />
            <span className="retranslate-action">
              <button
                type="button"
                className="retranslate-button"
                disabled={submit.kind === "submitting"}
                onClick={() => void handleSubmit()}
              >
                Save
              </button>
              {submit.kind !== "idle" ? (
                <span className={submitStatusClassName(submit)}>{submitStatusLabel(submit)}</span>
              ) : null}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
