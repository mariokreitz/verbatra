import { androidSegment } from "./android.js";
import { NUMERIC_REGION, parseLocaleTag } from "./tag.js";

/** The locale styles a files pattern's `{locale}` token can expand under. */
export const LOCALE_STYLES = ["literal", "posix", "android"] as const;

/**
 * How a configured locale is spelled inside a path:
 *
 * - `literal` (the default) expands the token to the configured tag verbatim. This covers the
 *   i18next, vue-i18n, next-intl, ngx-translate, XLIFF, YAML, and ARB layouts, and Apple's
 *   `.lproj` naming, which is the BCP-47 tag as written.
 * - `posix` replaces `-` with `_`, for gettext directories (`pt_BR/LC_MESSAGES/`) and the Java
 *   `messages_{locale}.properties` suffix layout.
 * - `android` expands the token to a complete Android resource-directory segment, `values` prefix
 *   included, and is the only style that spells the source locale differently from a target.
 *
 * A style may be relaxed to accept a locale it previously refused, but the spelling it already
 * produces must never change: a re-spelling orphans every file written under the old name, leaving
 * a stale directory the platform still prefers.
 */
export type LocaleStyle = (typeof LOCALE_STYLES)[number];

/** The styles whose expansion owns a whole path segment rather than part of one. */
const SEGMENT_STYLES: ReadonlySet<LocaleStyle> = new Set<LocaleStyle>(["android"]);

/** Characters that would let a locale steer the path somewhere the pattern does not point. */
const UNSAFE_IN_SEGMENT = /[/\\\0]/;

/** True when the style's expansion is a whole path segment, so the token must be one too. */
export function isSegmentStyle(style: LocaleStyle): boolean {
  return SEGMENT_STYLES.has(style);
}

/**
 * The POSIX spelling: the tag verbatim with `-` replaced by `_`, preserving the configured casing.
 * Only a language with an optional two-letter region has a correct underscore form, so a
 * script-bearing tag (`zh-Hans`), a variant, and a three-digit region are refused rather than
 * guessed at.
 */
function posixSpelling(locale: string): string | undefined {
  const tag = parseLocaleTag(locale);
  if (tag === undefined || tag.script !== undefined || tag.variants.length > 0) {
    return undefined;
  }
  if (tag.region !== undefined && NUMERIC_REGION.test(tag.region)) {
    return undefined;
  }
  return locale.replaceAll("-", "_");
}

/**
 * The path-segment spelling of one locale under one style, or `undefined` when the style has no
 * correct spelling for it. A style refuses rather than guesses, because a wrong directory name is
 * written successfully and then silently ignored at runtime, while a refusal is loud.
 */
export function spellLocale(
  locale: string,
  style: LocaleStyle,
  isSourceLocale: boolean,
): string | undefined {
  if (style === "android") {
    return androidSegment(locale, isSourceLocale);
  }
  return style === "posix" ? posixSpelling(locale) : locale;
}

/**
 * True when a spelling is a single path component that stays inside the directory the pattern points
 * at. Applied to every style, `literal` included, so a configured locale can never carry a separator
 * or a parent-directory reference into the expanded path.
 */
export function isSafeSpelling(spelling: string): boolean {
  return (
    spelling.length > 0 &&
    !UNSAFE_IN_SEGMENT.test(spelling) &&
    spelling !== "." &&
    spelling !== ".."
  );
}
