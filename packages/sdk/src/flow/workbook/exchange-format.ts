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

const exchangeFormatMembers: { [K in ExchangeFormat]: K } = {
  xlsx: "xlsx",
  csv: "csv",
  tsv: "tsv",
};

/**
 * Every {@link ExchangeFormat} at runtime, for a tool that has to validate a `--format` argument or
 * offer the choices to a user. The order is the order to present them in: the workbook first, then
 * the delimited forms.
 *
 * It is derived from a record keyed by {@link ExchangeFormat} itself, so a format added to the type
 * without being added here fails to compile. A consumer that checks membership against this list can
 * therefore never silently reject a format the SDK accepts.
 */
export const EXCHANGE_FORMATS: readonly ExchangeFormat[] = Object.values(exchangeFormatMembers);

/** The {@link ExchangeFormat} {@link exportWorkbook} and {@link importWorkbook} use when the caller names none. */
export const DEFAULT_EXCHANGE_FORMAT: ExchangeFormat = "xlsx";

export function isDelimitedFormat(format: ExchangeFormat): format is DelimitedFormat {
  return format === "csv" || format === "tsv";
}
