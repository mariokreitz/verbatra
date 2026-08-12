import { conventionalSubtags, type LocaleTag, NUMERIC_REGION, parseLocaleTag } from "./tag.js";

/** The default resource directory, which holds the source language and carries no qualifier. */
const SOURCE_SEGMENT = "values";

/** The most subtags the modified BCP-47 (`b+`) qualifier form can carry. */
const MAX_BCP47_SUBTAGS = 4;

/**
 * The language whose legacy qualifier would be consumed as the `car` UI-mode qualifier instead of as
 * a language, so Carib has to be written in the `b+` form.
 */
const UI_MODE_LANGUAGE_COLLISION = "car";

/**
 * True when the legacy `<lang>[-r<REGION>]` qualifier form cannot express this tag, so the modified
 * BCP-47 `b+` form has to be used. The legacy form has exactly one language slot and one two-letter
 * region slot, and its `car` spelling is taken by a UI-mode qualifier. Any one of these forces `b+`:
 *
 * 1. A script subtag is present; the legacy form has no script slot.
 * 2. A variant subtag is present; the legacy form has no variant slot.
 * 3. The region is a three-digit UN M.49 code; the legacy region slot is `r` plus two characters.
 * 4. The language is exactly `car`, which collides with the UI-mode qualifier.
 * 5. There are three or more subtags.
 *
 * Triggers 2, 3, and 4 are the ones a "script or three-plus subtags" rule misses, and each of them
 * would otherwise produce a directory name the platform does not recognize.
 */
function needsBcp47(tag: LocaleTag, subtagCount: number): boolean {
  return (
    tag.script !== undefined ||
    tag.variants.length > 0 ||
    (tag.region !== undefined && NUMERIC_REGION.test(tag.region)) ||
    tag.language === UI_MODE_LANGUAGE_COLLISION ||
    subtagCount >= 3
  );
}

/** The legacy qualifier: a language, optionally followed by `-r` and a two-letter region. */
function legacySegment(tag: LocaleTag): string {
  return tag.region === undefined
    ? `${SOURCE_SEGMENT}-${tag.language}`
    : `${SOURCE_SEGMENT}-${tag.language}-r${tag.region.toUpperCase()}`;
}

/**
 * The Android resource-directory segment for one locale, including the `values` prefix, or
 * `undefined` when no valid segment exists for it. A three-letter language is fine in the legacy
 * form (`values-fil-rPH`); a tag needing more than four `b+` subtags, or one that is not a
 * language-led BCP-47 tag at all (a bare region, for instance), has no expressible segment.
 *
 * The emitted casing (lower-case language, upper-case region, title-case script) is the convention
 * the platform tooling writes, chosen for readability and for diff stability against existing
 * projects. The parser accepts any casing on input, because the platform does too.
 *
 * `b+` qualifiers are ignored by platform versions that predate the modified BCP-47 parser, which is
 * present in AOSP from Android 5.0 (API 21) onward while Google's current documentation states API
 * 24 for BCP-47 language tags. On older devices a script-bearing or M.49 locale falls back to the
 * default resources. That is a platform floor, not a spelling error, and no directory name fixes it.
 */
export function androidSegment(locale: string, isSourceLocale: boolean): string | undefined {
  if (isSourceLocale) {
    return SOURCE_SEGMENT;
  }
  const tag = parseLocaleTag(locale);
  if (tag === undefined) {
    return undefined;
  }
  const subtags = conventionalSubtags(tag);
  if (!needsBcp47(tag, subtags.length)) {
    return legacySegment(tag);
  }
  if (subtags.length > MAX_BCP47_SUBTAGS) {
    return undefined;
  }
  return `${SOURCE_SEGMENT}-b+${subtags.join("+")}`;
}
