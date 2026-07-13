import { ProviderError } from "../errors.js";

/**
 * Target locale codes DeepL requires disambiguated: DeepL's target language set has no bare `en` or
 * `pt`, only their regional forms. Not a full BCP-47 mapping table, just the two languages DeepL
 * itself splits.
 */
const DEPRECATED_BARE_TARGET_CODES: ReadonlySet<string> = new Set(["en", "pt"]);

/**
 * Validate a source locale code before any DeepL network call. DeepL's source language set is entirely
 * bare codes (no regional variant is ever valid as a source), so any code carrying a region or script
 * subtag is rejected outright.
 *
 * @param locale - The configured source locale, verbatim.
 * @throws {@link ProviderError} `INVALID_REQUEST` naming the rejected code when it carries a subtag.
 */
export function assertValidDeepLSourceLocale(locale: string): void {
  if (locale.includes("-")) {
    throw new ProviderError(
      "INVALID_REQUEST",
      `DeepL does not accept a regional or script source locale code: "${locale}". Only the base ` +
        `language code is valid as a DeepL source (for example, use "en" instead of "en-US").`,
    );
  }
}

/**
 * Validate a target locale code before any DeepL network call: rejects a deprecated bare target code
 * that DeepL requires disambiguated. Everything else, including title-case script subtags like
 * `zh-Hans`, is left to DeepL's own client-side normalization (deepl-node lowercases the language
 * segment and uppercases the region/script segment before sending, so `zh-Hans` and `zh-HANS` both
 * resolve to the same valid code); rejecting it here would be a false negative, not a safety net.
 *
 * @param locale - The configured target locale, verbatim.
 * @throws {@link ProviderError} `INVALID_REQUEST` naming the rejected code.
 */
export function assertValidDeepLTargetLocale(locale: string): void {
  if (DEPRECATED_BARE_TARGET_CODES.has(locale.toLowerCase())) {
    throw new ProviderError(
      "INVALID_REQUEST",
      `DeepL requires a disambiguated target locale code instead of "${locale}" (for example, ` +
        `"en-GB" or "en-US" for English, "pt-PT" or "pt-BR" for Portuguese).`,
    );
  }
}
