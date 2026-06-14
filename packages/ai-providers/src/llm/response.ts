import { ProviderError } from "../errors.js";
import { translationsResultSchema } from "./schema.js";

/**
 * Reconcile the returned translations against the requested keys: reject any extra
 * key, any duplicate key, and any missing key. The result is a complete map keyed
 * by the original entry keys (key-in equals key-out).
 */
function reconcile(
  translations: readonly { readonly key: string; readonly value: string }[],
  requestedKeys: readonly string[],
): Map<string, string> {
  const requested = new Set(requestedKeys);
  const values = new Map<string, string>();
  for (const { key, value } of translations) {
    if (!requested.has(key) || values.has(key)) {
      throw new ProviderError(
        "INVALID_RESPONSE",
        "The provider returned an unexpected or duplicate key.",
      );
    }
    values.set(key, value);
  }
  if (values.size !== requested.size) {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "The provider response is missing one or more keys.",
    );
  }
  return values;
}

/**
 * The single validation boundary for every LLM provider. The raw schema-bound
 * output is validated against the canonical schema (our side, regardless of any
 * SDK parsing) and reconciled with the requested keys. Any malformed, extra-,
 * duplicate-, or missing-key output is rejected with a structured error; output is
 * treated strictly as data, never executed or interpreted.
 */
export function reconcileResult(
  raw: unknown,
  requestedKeys: readonly string[],
): Map<string, string> {
  const parsed = translationsResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "The provider returned a malformed translation payload.",
    );
  }
  return reconcile(parsed.data.translations, requestedKeys);
}
