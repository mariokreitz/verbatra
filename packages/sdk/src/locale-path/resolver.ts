import { resolve } from "node:path";
import { SdkError } from "../errors.js";
import { expandPattern, LOCALE_TOKEN, tokenOccupiesWholeSegments } from "./pattern.js";
import { isSafeSpelling, isSegmentStyle, type LocaleStyle, spellLocale } from "./style.js";

/** The style applied when `files.localeStyle` is absent: the configured tag, verbatim. */
const DEFAULT_LOCALE_STYLE: LocaleStyle = "literal";

/**
 * The part of the project config locale-to-path resolution depends on. Deliberately structural, so a
 * caller holding a full `VerbatraConfig` passes it unchanged while a test can build one inline.
 */
export interface LocalePathResolverConfig {
  readonly sourceLocale: string;
  readonly targetLocales: readonly string[];
  readonly files: {
    readonly pattern: string;
    readonly localeStyle?: LocaleStyle | undefined;
  };
}

/**
 * The project's locale-to-path mapping, resolved once from the config and threaded through every
 * flow that needs a path. Holding one object rather than a `(pattern, style, sourceLocale)` triple
 * is what keeps a source-aware style from producing a wrong path in a flow that only threaded part
 * of it.
 */
export interface LocalePathResolver {
  /**
   * The absolute file path for one locale. Never throws for a configured locale: every one of them
   * is spelled and checked when the resolver is created.
   *
   * @throws SdkError `LOCALE_LAYOUT_INVALID` when the style cannot spell an unconfigured locale
   * passed in after construction.
   */
  pathFor(locale: string): string;
  /**
   * Which configured locale a path belongs to, or `undefined` when it belongs to none of them. This
   * is a lookup in the forward map, never a parse: the configured locale list is the only authority
   * on which locales exist. A relative argument is resolved against the same `cwd` the resolver was
   * created with; the match is exact, so a path differing only in case does not resolve even on a
   * case-insensitive file system.
   *
   * `undefined` is not an error. It means the path is not one of this project's locale files, which
   * is what a watcher needs to know in order to ignore it.
   */
  localeFor(absolutePath: string): string | undefined;
}

/** Rejects a pattern the style cannot be combined with, before any locale is spelled. */
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

/** The checked path-segment spelling of one locale, or a structured refusal naming why there is none. */
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

/**
 * The path-to-locale map for the source locale and every configured target, which doubles as the
 * injectivity check: two locales sharing one path would make the reverse direction meaningless and
 * would let two concurrent locale workers race on the same file.
 */
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

/**
 * Creates the project's locale-to-path resolver. Every check runs here, before any file is read and
 * before any provider call: the pattern must carry the `{locale}` token and must be combinable with
 * the declared style, the style must have a valid spelling for the source locale and every target,
 * and no two locales may resolve to the same path.
 *
 * Under the default `literal` style the produced path is the pattern with `{locale}` replaced by the
 * configured tag, resolved against `cwd`, which is what every project without a `files.localeStyle`
 * gets and is unchanged from before styles existed.
 *
 * @param cwd - Directory the files pattern resolves against.
 * @param config - The project's locales, files pattern, and locale style.
 * @throws SdkError `LOCALE_LAYOUT_INVALID` when the pattern and style cannot be combined, or the
 * style cannot spell a configured locale.
 * @throws SdkError `LOCALE_PATH_COLLISION` when two configured locales resolve to the same path.
 */
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
