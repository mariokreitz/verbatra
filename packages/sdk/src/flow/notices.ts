import type { ProviderNotice, TranslateResult } from "@verbatra/ai-providers";

export function readNotices(result: TranslateResult): readonly ProviderNotice[] {
  return result.notices ?? [];
}
