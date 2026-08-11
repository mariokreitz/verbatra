import type { DelimitedFormat } from "@verbatra/exchange";

/**
 * The interchange format a handoff moves in. `xlsx` is the default and the only shape that carries
 * every target locale in one artifact; `csv` and `tsv` are plain text and move one file per target
 * locale, so their path names a directory rather than a file.
 */
export type ExchangeFormat = "xlsx" | DelimitedFormat;

/** Whether the format is one of the delimited text formats, which move one file per target locale. */
export function isDelimitedFormat(format: ExchangeFormat): format is DelimitedFormat {
  return format === "csv" || format === "tsv";
}
