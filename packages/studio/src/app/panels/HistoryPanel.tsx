import type { ReactNode } from "react";
import { CommitList } from "../CommitList.js";
import { PageHeader } from "../PageHeader.js";
import { useHistoryList } from "../use-history-list.js";

/**
 * Commit history for the source and target locale files, from `git log` through `history.list`.
 * `available: false` (git is missing, or the project is not a git repository at all) renders as
 * its own state, distinct from an available history that simply has no commits yet. History
 * before a file rename is never shown (`git log` never runs with `--follow`).
 */
export function HistoryPanel(): ReactNode {
  const state = useHistoryList();

  return (
    <>
      <PageHeader title="History" description="Commit history for the project's locale files." />
      <CommitList
        state={state}
        emptyMessage="No commit history yet for the source or target locale files."
      />
    </>
  );
}
