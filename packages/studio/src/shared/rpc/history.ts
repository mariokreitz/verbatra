import { z } from "zod";

export const HISTORY_LIST_METHOD = "history.list";

export const historyListParamsSchema = z.strictObject({
  limit: z.number().int().positive().optional(),
});

export type HistoryListParams = z.infer<typeof historyListParamsSchema>;

export interface HistoryCommit {
  readonly hash: string;
  readonly authorDate: string;
  readonly subject: string;
  readonly touchedPaths: readonly string[];
}

export type HistoryListResult =
  | { readonly available: false }
  | { readonly available: true; readonly commits: readonly HistoryCommit[] };
