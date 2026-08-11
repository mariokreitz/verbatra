import { ExchangeError } from "./errors.js";

/**
 * The two delimiter-separated interchange formats. They are one implementation with one parameter, the
 * field delimiter: `tsv` is not a second format, it is `csv` with a tab.
 */
export type DelimitedFormat = "csv" | "tsv";

/** The field delimiter each format separates its columns with. */
export const DELIMITER: Readonly<Record<DelimitedFormat, string>> = {
  csv: ",",
  tsv: "\t",
};

/**
 * Characters a locale must not contain for `<locale>.<format>` to stay a plain file name inside the
 * output directory: the path separators of either platform, the characters Windows forbids in a file
 * name, and any control character.
 */
const FORBIDDEN_FILE_NAME_CHARS = /[\\/:*?"<>|\p{Cc}]/u;

/**
 * Reject a locale that cannot be a plain file name. A delimited export writes one file per locale and
 * an import maps the file name back to the locale, so a locale carrying a path separator or a relative
 * segment would escape the output directory instead of naming a file in it.
 *
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the locale cannot be a plain file name
 */
function assertPlainFileLocale(locale: string): void {
  if (locale.length === 0 || locale === "." || locale === "..") {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The locale "${locale}" cannot be an interchange file name: it must name a file, not a directory.`,
    );
  }
  if (FORBIDDEN_FILE_NAME_CHARS.test(locale)) {
    throw new ExchangeError(
      "WORKBOOK_INVALID",
      `The locale "${locale}" cannot be an interchange file name: it must not contain a path separator, a control character, or any of : * ? " < > | .`,
    );
  }
}

/**
 * The file name one locale's interchange file carries. A delimited handoff has no sheets, so the
 * sheet-per-locale model maps to one `<locale>.<format>` file per locale in the output directory, and
 * the locale is read back from the file name on import.
 *
 * @param locale - the target locale the file carries
 * @param format - the delimited format, which is also the file extension
 * @returns the file name, without any directory part
 * @throws {@link ExchangeError} `WORKBOOK_INVALID` if the locale cannot be a plain file name
 */
export function delimitedFileName(locale: string, format: DelimitedFormat): string {
  assertPlainFileLocale(locale);
  return `${locale}.${format}`;
}
