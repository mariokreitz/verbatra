import { z } from "zod";

/** The RPC method name for the git-log history view. */
export const HISTORY_LIST_METHOD = "history.list";

/** Bounded by a cap on the server side regardless; the schema only rejects an obviously invalid limit. */
export const historyListParamsSchema = z.strictObject({
  limit: z.number().int().positive().optional(),
});

/** Parsed `history.list` params. */
export type HistoryListParams = z.infer<typeof historyListParamsSchema>;

/** One commit that touched the watched locale files. */
export interface HistoryCommit {
  readonly hash: string;
  readonly authorDate: string;
  readonly subject: string;
  readonly touchedPaths: readonly string[];
}

/**
 * The commit history for the watched locale files, or unavailable when git itself is missing or
 * the project is not a repository. Never an error: both are ordinary, renderable results.
 */
export type HistoryListResult =
  | { readonly available: false }
  | { readonly available: true; readonly commits: readonly HistoryCommit[] };
