import { ProviderError } from "../errors.js";
import { translationsResultSchema } from "./schema.js";

export interface ReconcileOutcome {
  readonly accepted: Map<string, string>;
  readonly missingKeys: readonly string[];
}

interface RawTranslation {
  readonly key: string;
  readonly value: string;
}

function partitionTranslations(
  translations: readonly RawTranslation[],
  requested: ReadonlySet<string>,
): { readonly firstSeen: Map<string, string>; readonly duplicated: Set<string> } {
  const firstSeen = new Map<string, string>();
  const duplicated = new Set<string>();
  for (const { key, value } of translations) {
    if (!requested.has(key)) {
      throw new ProviderError("INVALID_RESPONSE", "The provider returned an unexpected key.");
    }
    if (firstSeen.has(key)) {
      duplicated.add(key);
      continue;
    }
    firstSeen.set(key, value);
  }
  return { firstSeen, duplicated };
}

function reconcile(
  translations: readonly RawTranslation[],
  requestedKeys: readonly string[],
): ReconcileOutcome {
  const requested = new Set(requestedKeys);
  const { firstSeen, duplicated } = partitionTranslations(translations, requested);
  const missingKeys = requestedKeys.filter((key) => duplicated.has(key) || !firstSeen.has(key));
  for (const key of duplicated) {
    firstSeen.delete(key);
  }
  return { accepted: firstSeen, missingKeys };
}

export function reconcileResult(raw: unknown, requestedKeys: readonly string[]): ReconcileOutcome {
  const parsed = translationsResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "The provider returned a malformed translation payload.",
    );
  }
  return reconcile(parsed.data.translations, requestedKeys);
}
