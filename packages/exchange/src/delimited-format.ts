import { ExchangeError } from "./errors.js";

/**
 * The two delimiter-separated interchange formats. They are one implementation with one parameter, the
 * field delimiter: `tsv` is not a second format, it is `csv` with a tab. The member is also the file
 * extension an export writes and an import reads back.
 */
export type DelimitedFormat = "csv" | "tsv";

export const DELIMITER: Readonly<Record<DelimitedFormat, string>> = {
  csv: ",",
  tsv: "\t",
};

export const QUOTE = '"';

export const UTF8_BOM = "\ufeff";

const FORBIDDEN_FILE_NAME_CHARS = /[\\/:*?"<>|\p{Cc}]/u;

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

export function delimitedFileName(locale: string, format: DelimitedFormat): string {
  assertPlainFileLocale(locale);
  return `${locale}.${format}`;
}
