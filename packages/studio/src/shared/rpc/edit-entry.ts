import { z } from "zod";

/** The RPC method name for writing exactly one human-typed correction into exactly one target locale. */
export const EDIT_ENTRY_METHOD = "translation.editEntry";

/**
 * Shape-only: `locale` and `key` are non-empty strings, `value` is capped in length. Declared
 * unconditionally in the shared contract, independent of which capability flags a given server
 * instance was started with; semantic target resolution (is this a configured locale, does this
 * key exist in the source) happens inside the sdk seam, never at this schema boundary. Neither
 * `locale` nor `key` is ever a file path.
 */
export const editEntryParamsSchema = z.strictObject({
  locale: z.string().min(1),
  key: z.string().min(1),
  value: z.string().max(20_000),
});

export type EditEntryParams = z.infer<typeof editEntryParamsSchema>;

/**
 * The two-armed result: `accepted` carries the newly written value (the correction the caller
 * explicitly typed, not a secret); a rejection carries the candidate value and which check failed
 * it, without writing anything. Never a thrown error for an integrity failure: a well-formed
 * request that was rejected on its merits is data, not an error response. Unlike
 * `RetranslateEntryResult`, there is no `reviewReasons` field: this seam never calls a provider, so
 * there is no provider-derived review signal to report.
 */
export type EditEntryResult =
  | {
      readonly accepted: true;
      readonly value: string;
    }
  | {
      readonly accepted: false;
      readonly reason: "placeholder" | "icu";
      readonly value: string;
    };
