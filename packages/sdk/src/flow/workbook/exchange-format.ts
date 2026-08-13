import type { DelimitedFormat } from "@verbatra/exchange";

export type ExchangeFormat = "xlsx" | DelimitedFormat;

export function isDelimitedFormat(format: ExchangeFormat): format is DelimitedFormat {
  return format === "csv" || format === "tsv";
}
