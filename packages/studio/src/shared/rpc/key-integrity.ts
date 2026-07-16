import { z } from "zod";

/** The RPC method name for one key's placeholder or ICU integrity, per target locale. */
export const KEY_INTEGRITY_METHOD = "key.integrity";

/** Scoped to exactly the one key currently open in the drawer; an omitted `locales` means every configured target locale. */
export const keyIntegrityParamsSchema = z.strictObject({
  key: z.string().min(1),
  locales: z.array(z.string().min(1)).min(1).optional(),
});

/** Parsed `key.integrity` params. */
export type KeyIntegrityParams = z.infer<typeof keyIntegrityParamsSchema>;

/**
 * One target locale's placeholder or ICU integrity result for the requested key. Present only for
 * a locale where the key is currently "changed" (a current source and a current target value both
 * exist); a locale where the key is missing, orphaned, or already in sync carries no entry here.
 *
 * Never carries a full source or target string value: only the boolean results and, on a
 * placeholder mismatch, the specific tokens involved (for example `"{{name}}"`), never the
 * surrounding sentence.
 */
export interface KeyIntegrityLocaleResult {
  readonly locale: string;
  /** False when the source value carries no placeholders at all; `matches` is then trivially true and not a meaningful signal on its own. */
  readonly hasPlaceholders: boolean;
  readonly matches: boolean;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  /** Whether the target value parses as valid ICU MessageFormat. Always true for a non-ICU format. Computed independently of `matches`. */
  readonly icuValid: boolean;
}

/** The result of `key.integrity`: one entry per target locale where the requested key is "changed". */
export interface KeyIntegrityResult {
  readonly locales: readonly KeyIntegrityLocaleResult[];
}
