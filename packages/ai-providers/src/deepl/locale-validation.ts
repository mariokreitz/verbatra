import { ProviderError } from "../errors.js";

const DEPRECATED_BARE_TARGET_CODES: ReadonlySet<string> = new Set(["en", "pt"]);

export function assertValidDeepLSourceLocale(locale: string): void {
  if (locale.includes("-")) {
    throw new ProviderError(
      "INVALID_REQUEST",
      `DeepL does not accept a regional or script source locale code: "${locale}". Only the base ` +
        `language code is valid as a DeepL source (for example, use "en" instead of "en-US").`,
    );
  }
}

export function assertValidDeepLTargetLocale(locale: string): void {
  if (DEPRECATED_BARE_TARGET_CODES.has(locale.toLowerCase())) {
    throw new ProviderError(
      "INVALID_REQUEST",
      `DeepL requires a disambiguated target locale code instead of "${locale}" (for example, ` +
        `"en-GB" or "en-US" for English, "pt-PT" or "pt-BR" for Portuguese).`,
    );
  }
}
