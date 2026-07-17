import type { ReviewReasonCode } from "@verbatra/sdk";
import { z } from "zod";

/** The RPC method name for retranslating exactly one key into exactly one target locale. */
export const RETRANSLATE_ENTRY_METHOD = "translation.retranslateEntry";

/**
 * Shape-only: `locale` and `key` are non-empty strings. Declared unconditionally in the shared
 * contract, independent of which capability flags a given server instance was started with;
 * semantic target resolution (is this a configured locale, does this key exist in the source)
 * happens inside the sdk seam, never at this schema boundary. Neither field is ever a file path.
 */
export const retranslateEntryParamsSchema = z.strictObject({
  locale: z.string().min(1),
  key: z.string().min(1),
});

/** Parsed `translation.retranslateEntry` params. */
export type RetranslateEntryParams = z.infer<typeof retranslateEntryParamsSchema>;

/**
 * The two-armed result: `accepted` carries the newly written value (the translation the caller
 * explicitly requested, not a secret) and any derived "needs review" reasons; a rejection carries
 * the candidate value and which check failed it, without writing anything. Never a thrown error
 * for an integrity failure: a well-formed request that was rejected on its merits is data, not an
 * error response.
 */
export type RetranslateEntryResult =
  | {
      readonly accepted: true;
      readonly value: string;
      readonly reviewReasons: readonly ReviewReasonCode[];
    }
  | {
      readonly accepted: false;
      readonly reason: "placeholder" | "icu";
      readonly value: string;
    };
