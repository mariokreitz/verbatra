import { androidSegment } from "./android.js";
import { NUMERIC_REGION, parseLocaleTag } from "./tag.js";

export const LOCALE_STYLES = ["literal", "posix", "android"] as const;

export type LocaleStyle = (typeof LOCALE_STYLES)[number];

const SEGMENT_STYLES: ReadonlySet<LocaleStyle> = new Set<LocaleStyle>(["android"]);

const UNSAFE_IN_SEGMENT = /[/\\\0]/;

export function isSegmentStyle(style: LocaleStyle): boolean {
  return SEGMENT_STYLES.has(style);
}

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

export function isSafeSpelling(spelling: string): boolean {
  return (
    spelling.length > 0 &&
    !UNSAFE_IN_SEGMENT.test(spelling) &&
    spelling !== "." &&
    spelling !== ".."
  );
}
