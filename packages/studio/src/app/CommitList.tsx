import type { ReactNode } from "react";
import { renderCommitSummary } from "../client/render-text.js";
import type { HistoryCommit } from "../shared/rpc/history.js";
import { Badge } from "./Badge.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { Loading } from "./Loading.js";
import type { HistoryState } from "./use-history-list.js";

/**
 * The files a commit touched, from `history.list`'s `touchedPaths`. Rendered as a wrapping row of
 * monospace path chips rather than appended to the summary line, since a commit can touch several
 * locale files at once and the summary line already carries the hash, date, and subject.
 */
function TouchedPaths({ paths }: { readonly paths: readonly string[] }): ReactNode {
  if (paths.length === 0) {
    return null;
  }
  return (
    <ul className="commit-touched-paths" aria-label="Files changed">
      {paths.map((path) => (
        <li key={path} className="commit-touched-path mono">
          {path}
        </li>
      ))}
    </ul>
  );
}

/**
 * One commit's summary line plus the files it touched. The summary is rendered through
 * {@link renderCommitSummary} (`src/client/`, covered) via a ref callback into `textContent`, so
 * that logic stays unit-tested outside a browser (`src/app` has no browser test harness, see
 * `vitest.config.ts`). `touchedPaths` renders as ordinary JSX children instead: React's JSX child
 * rendering already writes strings to DOM text nodes, the same anti-markup guarantee `textContent`
 * gives `renderCommitSummary`, just without a plain-object-friendly seam to unit test through, so
 * there is nothing this component needs the ref/`textContent` pattern for here.
 */
function CommitRow({ commit }: { readonly commit: HistoryCommit }): ReactNode {
  return (
    <li className="commit-row">
      <p
        className="commit-summary"
        ref={(element) => {
          if (element !== null) {
            renderCommitSummary(element, commit);
          }
        }}
      />
      <TouchedPaths paths={commit.touchedPaths} />
    </li>
  );
}

export interface CommitListProps {
  readonly state: HistoryState;
  /** Class name for the "unavailable" and "no commits yet" paragraphs. */
  readonly emptyClassName: string;
  /** Message shown once history is loaded but has no commits. */
  readonly emptyMessage: string;
}

/** Renders a {@link HistoryState} as loading, an error, unavailable, empty, or a commit list. */
export function CommitList({ state, emptyClassName, emptyMessage }: CommitListProps): ReactNode {
  if (state.kind === "loading") {
    return <Loading />;
  }
  if (state.kind === "error") {
    return <ErrorMessage message={state.message} />;
  }
  if (state.kind === "unavailable") {
    return (
      <p className={emptyClassName}>
        <Badge tone="neutral">Unavailable</Badge> This project is not a git repository, or git is
        not installed.
      </p>
    );
  }
  if (state.commits.length === 0) {
    return <p className={emptyClassName}>{emptyMessage}</p>;
  }
  return (
    <ul className="commit-list">
      {state.commits.map((commit) => (
        <CommitRow commit={commit} key={commit.hash} />
      ))}
    </ul>
  );
}
