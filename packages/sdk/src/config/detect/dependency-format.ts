import type { SupportedFormat } from "@verbatra/core";

/**
 * Which npm dependency implies which locale file format. Four of the eight supported formats share
 * the `.json` extension, so no amount of looking at a file can tell them apart; the package a
 * project depends on is the only reliable signal, and it is the one both `verbatra init` and
 * zero-config detection read.
 *
 * The remaining formats (XLIFF, YAML, ARB, and Java properties) are identified by file extension
 * instead and have no entry here.
 */
export const FORMAT_BY_DEPENDENCY: ReadonlyArray<readonly [string, SupportedFormat]> = [
  ["i18next", "i18next-json"],
  ["vue-i18n", "vue-i18n-json"],
  ["next-intl", "next-intl-json"],
  ["@ngx-translate/core", "ngx-translate-json"],
];

/**
 * Picks the locale file format a project's dependencies imply.
 *
 * Only an unambiguous answer is returned: a project depending on both `i18next` and `next-intl`
 * yields `undefined`, exactly as one depending on neither does, because guessing between two
 * incompatible JSON dialects would silently mis-read every plural and every ICU message.
 *
 * @param dependencyNames - Every dependency and devDependency name declared by the project.
 * @returns The single implied format, or `undefined` when none or more than one matches.
 */
export function formatFromDependencyNames(
  dependencyNames: Iterable<string>,
): SupportedFormat | undefined {
  const names = new Set(dependencyNames);
  const matches = FORMAT_BY_DEPENDENCY.filter(([name]) => names.has(name)).map(
    ([, format]) => format,
  );
  const [first, second] = matches;
  return second === undefined ? first : undefined;
}
