/** The token in a files pattern that is replaced by a locale's path-segment spelling. */
export const LOCALE_TOKEN = "{locale}";

/** Matches either path separator, so a pattern authored on Windows splits the same way as a POSIX one. */
const SEPARATOR = /[/\\]/;

/**
 * True when every occurrence of {@link LOCALE_TOKEN} in the pattern is a whole path segment, alone
 * between separators. Segment styles own the entire segment they produce, so an embedded token such
 * as `res/values-{locale}/strings.xml` would double-prefix into `res/values-values-de/`: a directory
 * that writes successfully and that the platform then ignores.
 */
export function tokenOccupiesWholeSegments(pattern: string): boolean {
  return pattern
    .split(SEPARATOR)
    .every((segment) => segment === LOCALE_TOKEN || !segment.includes(LOCALE_TOKEN));
}

/**
 * Substitutes a locale's spelling into every occurrence of {@link LOCALE_TOKEN}. The replacement is
 * a function so that a `$` in the spelling is inserted literally rather than read as a
 * `String.replace` substitution pattern.
 */
export function expandPattern(pattern: string, spelling: string): string {
  return pattern.replaceAll(LOCALE_TOKEN, () => spelling);
}
