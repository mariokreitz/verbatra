import type { HistoryCommit } from "../shared/rpc/history.js";

/**
 * The minimal, writable surface this module ever touches: a real DOM `Text` or `Element` node's
 * `textContent` setter (typed nullable to match the DOM lib's own declaration), or a plain object
 * standing in for one in a test. There is deliberately no `innerHTML` (or any other markup-parsing
 * setter) on this type, so a value of this shape cannot be used to interpolate HTML even by
 * mistake; the safety this module provides is structural, not a matter of remembering to escape.
 */
export interface TextTarget {
  textContent: string | null;
}

/**
 * One commit's plain-text summary line: its short hash, ISO author date, and subject, joined by a
 * single space. Never markup: every field renders exactly as git reported it, with no HTML
 * entities decoded or escaped, because it is never interpreted as HTML in the first place.
 */
export function formatCommitSummary(commit: HistoryCommit): string {
  return `${commit.hash.slice(0, 7)} ${commit.authorDate} ${commit.subject}`;
}

/**
 * Writes a commit's summary into `target.textContent`, never through `innerHTML` or any other
 * markup-interpreting sink. Whatever `commit.subject` contains, including something shaped like
 * `<script>`, ends up as literal text: a real `textContent` assignment never parses its argument
 * as markup, so this is safe by construction rather than by escaping.
 */
export function renderCommitSummary(target: TextTarget, commit: HistoryCommit): void {
  target.textContent = formatCommitSummary(commit);
}
