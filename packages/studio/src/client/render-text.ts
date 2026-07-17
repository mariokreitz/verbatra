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
 * Writes plain text into `target.textContent`, never through `innerHTML` or any other
 * markup-interpreting sink. Whatever the text contains, including something shaped like
 * `<script>`, ends up as literal text: a real `textContent` assignment never parses its argument
 * as markup, so this is safe by construction rather than by escaping. The commit feed renders
 * every git-sourced string (hash, date, subject) through this one seam.
 */
export function renderText(target: TextTarget, text: string): void {
  target.textContent = text;
}

/** The visually distinct pieces of one commit's feed row, each still plain text. */
export interface CommitSummaryParts {
  /** The hash's first 7 characters, the conventional short form. */
  readonly shortHash: string;
  /** The calendar-date prefix of the strict ISO author date (git `%aI`), for the compact meta row. */
  readonly dateLabel: string;
  /** The full ISO author date, for a hover title on the compact label. */
  readonly authorDate: string;
  readonly subject: string;
}

/**
 * Splits one commit into the parts the feed row renders separately (a hash chip, a date label,
 * the subject line). Every field is passed through or sliced, never interpreted; each part is
 * still written to the DOM via {@link renderText}, so the anti-markup guarantee holds per part.
 */
export function commitSummaryParts(commit: HistoryCommit): CommitSummaryParts {
  return {
    shortHash: commit.hash.slice(0, 7),
    dateLabel: commit.authorDate.slice(0, 10),
    authorDate: commit.authorDate,
    subject: commit.subject,
  };
}
