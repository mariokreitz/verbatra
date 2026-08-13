export const LOCALE_TOKEN = "{locale}";

const SEPARATOR = /[/\\]/;

export function tokenOccupiesWholeSegments(pattern: string): boolean {
  return pattern
    .split(SEPARATOR)
    .every((segment) => segment === LOCALE_TOKEN || !segment.includes(LOCALE_TOKEN));
}

export function expandPattern(pattern: string, spelling: string): string {
  return pattern.replaceAll(LOCALE_TOKEN, () => spelling);
}
