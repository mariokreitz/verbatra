import { extractSingleBraceTokens } from "../single-brace/tokens.js";

export function extractVueI18nPlaceholders(value: string): readonly string[] {
  return extractSingleBraceTokens(value);
}
