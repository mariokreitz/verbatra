import type { ProviderNotice, TranslateResult } from "@verbatra/ai-providers";

function isNotice(value: unknown): value is ProviderNotice {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

/**
 * Read the optional provider notices off a translate result. Only machine-translation
 * results (DeepL) carry notices, attached structurally; LLM results have none. Notices
 * are surfaced to the caller, never swallowed.
 */
export function readNotices(result: TranslateResult): readonly ProviderNotice[] {
  const candidate = (result as { notices?: unknown }).notices;
  if (!Array.isArray(candidate)) {
    return [];
  }
  return candidate.filter(isNotice);
}
