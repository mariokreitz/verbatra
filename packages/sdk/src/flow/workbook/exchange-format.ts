import type { DelimitedFormat } from "@verbatra/exchange";

/**
 * The file shape of a translator handoff: a single styled `.xlsx` workbook with one sheet per
 * locale, or one plain `.csv` or `.tsv` file per locale.
 *
 * The workbook is the friendlier artifact to hand a human translator, while the delimited forms are
 * easier to diff, review, and feed to another tool. {@link exportWorkbook} and
 * {@link importWorkbook} both accept either.
 */
export type ExchangeFormat = "xlsx" | DelimitedFormat;

export function isDelimitedFormat(format: ExchangeFormat): format is DelimitedFormat {
  return format === "csv" || format === "tsv";
}
