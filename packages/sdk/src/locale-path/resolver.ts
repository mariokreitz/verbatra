import { resolve } from "node:path";
import { SdkError } from "../errors.js";
import { expandPattern, LOCALE_TOKEN, tokenOccupiesWholeSegments } from "./pattern.js";
import { isSafeSpelling, isSegmentStyle, type LocaleStyle, spellLocale } from "./style.js";

const DEFAULT_LOCALE_STYLE: LocaleStyle = "literal";

export interface LocalePathResolverConfig {
  readonly sourceLocale: string;
  readonly targetLocales: readonly string[];
  readonly files: {
    readonly pattern: string;
    readonly localeStyle?: LocaleStyle | undefined;
  };
}

export interface LocalePathResolver {
  pathFor(locale: string): string;
  localeFor(absolutePath: string): string | undefined;
}

function validatePattern(pattern: string, style: LocaleStyle): void {
  if (!pattern.includes(LOCALE_TOKEN)) {
    throw new SdkError(
      "LOCALE_LAYOUT_INVALID",
      `The files pattern "${pattern}" must contain the ${LOCALE_TOKEN} token.`,
    );
  }
  if (isSegmentStyle(style) && !tokenOccupiesWholeSegments(pattern)) {
    throw new SdkError(
      "LOCALE_LAYOUT_INVALID",
      `The "${style}" locale style expands ${LOCALE_TOKEN} to a whole path segment, so the token must stand alone between separators, but the pattern "${pattern}" embeds it in a segment.`,
    );
  }
}

function safeSpelling(locale: string, style: LocaleStyle, sourceLocale: string): string {
  const spelling = spellLocale(locale, style, locale === sourceLocale);
  if (spelling === undefined) {
    throw new SdkError(
      "LOCALE_LAYOUT_INVALID",
      `The "${style}" locale style has no valid path spelling for the locale "${locale}".`,
    );
  }
  if (!isSafeSpelling(spelling)) {
    throw new SdkError(
      "LOCALE_LAYOUT_INVALID",
      `The locale "${locale}" expands to "${spelling}" under the "${style}" locale style, which is not a single path segment.`,
    );
  }
  return spelling;
}

function buildForwardMap(
  config: LocalePathResolverConfig,
  pathFor: (locale: string) => string,
): ReadonlyMap<string, string> {
  const forward = new Map<string, string>();
  for (const locale of [config.sourceLocale, ...config.targetLocales]) {
    const path = pathFor(locale);
    const claimed = forward.get(path);
    if (claimed !== undefined && claimed !== locale) {
      throw new SdkError(
        "LOCALE_PATH_COLLISION",
        `The locales "${claimed}" and "${locale}" both resolve to ${path}.`,
      );
    }
    forward.set(path, locale);
  }
  return forward;
}

export function createLocalePathResolver(
  cwd: string,
  config: LocalePathResolverConfig,
): LocalePathResolver {
  const style = config.files.localeStyle ?? DEFAULT_LOCALE_STYLE;
  const pattern = config.files.pattern;
  validatePattern(pattern, style);

  const pathFor = (locale: string): string =>
    resolve(cwd, expandPattern(pattern, safeSpelling(locale, style, config.sourceLocale)));

  const forward = buildForwardMap(config, pathFor);
  return {
    pathFor,
    localeFor: (absolutePath: string): string | undefined =>
      forward.get(resolve(cwd, absolutePath)),
  };
}
