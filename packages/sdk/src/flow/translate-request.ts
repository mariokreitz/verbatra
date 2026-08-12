import type { Tone, TranslateRequest } from "@verbatra/ai-providers";
import type { TranslationEntry } from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";

/** The fields every {@link buildTranslateRequest} caller has in common, regardless of its own shape. */
export interface TranslateRequestContext {
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly adapter: FormatAdapter;
  readonly glossary: Readonly<Record<string, string>> | undefined;
  readonly tone: Tone | undefined;
}

/**
 * Assembles one provider request for `entries`. The adapter's `extractPlaceholders` always travels
 * with the request; `glossary`, `tone`, and the adapter's optional `comparePlaceholders` are spread
 * in only when defined rather than passed as an explicit undefined, which
 * `exactOptionalPropertyTypes` rejects. Shared by main translation, plural-form generation, and
 * single-key retranslation, which each satisfy {@link TranslateRequestContext} from their own
 * differently-shaped parameters.
 */
export function buildTranslateRequest(
  context: TranslateRequestContext,
  entries: readonly TranslationEntry[],
): TranslateRequest {
  return {
    sourceLocale: context.sourceLocale,
    targetLocale: context.targetLocale,
    entries,
    extractPlaceholders: context.adapter.extractPlaceholders,
    ...(context.glossary !== undefined ? { glossary: context.glossary } : {}),
    ...(context.tone !== undefined ? { tone: context.tone } : {}),
    ...(context.adapter.comparePlaceholders !== undefined
      ? { comparePlaceholders: context.adapter.comparePlaceholders }
      : {}),
  };
}
