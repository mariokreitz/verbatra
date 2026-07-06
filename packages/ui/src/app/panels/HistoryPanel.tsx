import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { renderCommitSummary } from "../../client/render-text.js";
import type { HistoryCommit } from "../../shared/rpc/history.js";
import { rpcClient } from "../api.js";
import { ErrorMessage } from "../ErrorMessage.js";
import { Loading } from "../Loading.js";

type HistoryPanelState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "unavailable" }
  | { readonly kind: "loaded"; readonly commits: readonly HistoryCommit[] };

/**
 * One commit's summary line. Rendered through {@link renderCommitSummary} (`src/client/`, covered)
 * via a ref callback rather than direct JSX interpolation, so the commit's fields, including its
 * message, always reach the DOM through `textContent`, never `innerHTML`.
 */
function CommitRow({ commit }: { readonly commit: HistoryCommit }): ReactNode {
  return (
    <li
      ref={(element) => {
        if (element !== null) {
          renderCommitSummary(element, commit);
        }
      }}
    />
  );
}

/**
 * Commit history for the source and target locale files, from `git log` through `history.list`.
 * `available: false` (git is missing, or the project is not a git repository at all) renders as
 * its own state, distinct from an available history that simply has no commits yet. History
 * before a file rename is never shown (`git log` never runs with `--follow`).
 */
export function HistoryPanel(): ReactNode {
  const [state, setState] = useState<HistoryPanelState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("history.list", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setState({ kind: "error", message: response.error.message });
        return;
      }
      if (!response.result.available) {
        setState({ kind: "unavailable" });
        return;
      }
      setState({ kind: "loaded", commits: response.result.commits });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return <Loading />;
  }
  if (state.kind === "error") {
    return <ErrorMessage message={state.message} />;
  }
  if (state.kind === "unavailable") {
    return (
      <p>History is unavailable: this project is not a git repository, or git is not installed.</p>
    );
  }
  if (state.commits.length === 0) {
    return <p>No commit history yet for the source or target locale files.</p>;
  }
  return (
    <ul>
      {state.commits.map((commit) => (
        <CommitRow commit={commit} key={commit.hash} />
      ))}
    </ul>
  );
}
