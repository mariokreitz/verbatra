/**
 * A small, non-exhaustive set of right-to-left language subtags: Arabic, Hebrew, Persian, and
 * Urdu. Checked against a locale's primary subtag only, so a regional variant like `ar-EG` or
 * `he_IL` still matches. Intentionally not configurable or complete: it exists to correctly set
 * `dir` on the handful of per-locale views this package renders, not to be a general-purpose
 * locale database.
 */
const RTL_LANGUAGE_SUBTAGS: ReadonlySet<string> = new Set(["ar", "he", "fa", "ur"]);

function primarySubtag(locale: string): string {
  return (locale.split(/[-_]/)[0] ?? "").toLowerCase();
}

/** True when `locale`'s primary language subtag is a known right-to-left language. */
export function isRtlLocale(locale: string): boolean {
  return RTL_LANGUAGE_SUBTAGS.has(primarySubtag(locale));
}
