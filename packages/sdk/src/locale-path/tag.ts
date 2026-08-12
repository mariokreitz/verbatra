/** A language subtag: two or three alphabetic characters. */
const LANGUAGE = /^[a-z]{2,3}$/;

/** A script subtag: exactly four alphabetic characters. */
const SCRIPT = /^[a-z]{4}$/;

/** A region subtag: two alphabetic characters, or a three-digit UN M.49 code. */
const REGION = /^([a-z]{2}|[0-9]{3})$/;

/** A three-digit UN M.49 region, which several layouts have to spell differently from an alphabetic one. */
export const NUMERIC_REGION = /^[0-9]{3}$/;

/** A variant subtag: five to eight alphanumerics, or four characters starting with a digit (`1996`). */
const VARIANT = /^([a-z0-9]{5,8}|[0-9][a-z0-9]{3})$/;

/**
 * A parsed BCP-47 locale tag, lower-cased throughout. Only the language, script, region, and variant
 * positions are modelled: extensions and private-use sequences have no place in a directory name and
 * are refused by {@link parseLocaleTag} instead of being carried around unused.
 */
export interface LocaleTag {
  readonly language: string;
  readonly script: string | undefined;
  readonly region: string | undefined;
  readonly variants: readonly string[];
}

/** The subtag at `index`, when it is present and matches `pattern`. */
function subtagIf(subtags: readonly string[], index: number, pattern: RegExp): string | undefined {
  const subtag = subtags[index];
  return subtag !== undefined && pattern.test(subtag) ? subtag : undefined;
}

/**
 * Parses a configured locale into its BCP-47 positions, or `undefined` when it is not a tag this
 * project can spell as a path segment. Casing is normalized away before parsing, so `pt-BR`,
 * `pt-br`, and `PT-BR` all parse to the same tag; the styles re-apply conventional casing when they
 * emit.
 */
export function parseLocaleTag(locale: string): LocaleTag | undefined {
  const subtags = locale.toLowerCase().split("-");
  const language = subtags[0];
  if (language === undefined || !LANGUAGE.test(language)) {
    return undefined;
  }
  let index = 1;
  const script = subtagIf(subtags, index, SCRIPT);
  index += script === undefined ? 0 : 1;
  const region = subtagIf(subtags, index, REGION);
  index += region === undefined ? 0 : 1;
  const variants = subtags.slice(index);
  if (!variants.every((variant) => VARIANT.test(variant))) {
    return undefined;
  }
  return { language, script, region, variants };
}

/** The tag's subtags in BCP-47 order, with the conventional casing each position is written in. */
export function conventionalSubtags(tag: LocaleTag): readonly string[] {
  const subtags = [tag.language];
  if (tag.script !== undefined) {
    subtags.push(tag.script.charAt(0).toUpperCase() + tag.script.slice(1));
  }
  if (tag.region !== undefined) {
    subtags.push(tag.region.toUpperCase());
  }
  subtags.push(...tag.variants);
  return subtags;
}
