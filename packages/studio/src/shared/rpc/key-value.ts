import { z } from "zod";

/** The RPC method name for reading one key's current source and target value in one target locale. */
export const KEY_VALUE_METHOD = "key.value";

/**
 * Shape-only: `locale` and `key` are non-empty strings. Semantic resolution (is this a configured
 * locale, does this key exist in the source) happens inside the sdk seam, never at this schema
 * boundary. Neither field is ever a file path.
 */
export const keyValueParamsSchema = z.strictObject({
  locale: z.string().min(1),
  key: z.string().min(1),
});

/** Parsed `key.value` params. */
export type KeyValueParams = z.infer<typeof keyValueParamsSchema>;

/**
 * The current source and target values for one key/locale pair. `target` is absent exactly when
 * the key does not yet exist in that target locale. Scoped to exactly one key/locale pair per
 * call; no bulk or generic "fetch content" method exists, or is ever justified by this feature
 * (see `.verbatra/adr/studio-key-integrity-and-word-diff-exposure.md`'s addendum).
 */
export interface KeyValueResult {
  readonly source: string;
  readonly target?: string;
}
