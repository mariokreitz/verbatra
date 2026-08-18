import { parseLocaleTag } from "../../locale-path/tag.js";

const DELIMITERS = new Set([".", "_", "-"]);

function isDelimited(text: string, start: number, end: number): boolean {
  const before = start === 0 ? undefined : text[start - 1];
  const after = end === text.length ? undefined : text[end];
  return (
    (before === undefined || DELIMITERS.has(before)) &&
    (after === undefined || DELIMITERS.has(after))
  );
}

export function isLocaleToken(token: string): boolean {
  const tag = parseLocaleTag(token);
  return tag !== undefined && tag.language.length === 2 && tag.variants.length === 0;
}

/** A locale code found inside a file or directory name, with the span it occupies. */
export interface LocaleTokenMatch {
  /** The locale exactly as it is spelled in the name. */
  readonly locale: string;
  /** Index of the token's first character within the name. */
  readonly start: number;
  /** Index one past the token's last character. */
  readonly end: number;
}

function pushMatch(matches: LocaleTokenMatch[], name: string, start: number, end: number): void {
  const token = name.slice(start, end);
  if (isDelimited(name, start, end) && isLocaleToken(token)) {
    matches.push({ locale: token, start, end });
  }
}

/**
 * Every substring of a name that could be a locale code, longest first. A name yields more than one
 * candidate whenever a shorter code nests inside a longer one, as `pt` does inside `pt-BR`; the
 * caller narrows the list down by requiring the resulting template to cover the whole directory.
 */
export function findLocaleTokens(name: string): readonly LocaleTokenMatch[] {
  const matches: LocaleTokenMatch[] = [];
  for (let start = 0; start < name.length; start += 1) {
    for (let end = name.length; end > start; end -= 1) {
      pushMatch(matches, name, start, end);
    }
  }
  return matches.sort((left, right) => right.locale.length - left.locale.length);
}
