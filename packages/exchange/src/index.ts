/**
 * Translator interchange for verbatra: a neutral, format-agnostic row model turned into a styled
 * `.xlsx` ({@link buildWorkbook}) and parsed back ({@link readWorkbook}), or into plain delimited text
 * ({@link buildDelimited}) and parsed back ({@link readDelimited}). It is composed by `@verbatra/sdk`
 * and depends on none of `@verbatra/core`, `format-adapters`, `sdk`, or `cli`. It runs no translation
 * check and touches no locale or lock file.
 *
 * Both readers return the same {@link WorkbookData}, so one handoff channel is not judged differently
 * from the other. The delimited channel trades the workbook's protection for diffability: a workbook
 * leaves only the translation column editable and hides the source hash, while a delimited file has
 * every field editable and its source hash visible. An edited source hash is never trusted, it is
 * compared against the live source on import and withheld as drift.
 *
 * Returned input of either shape is untrusted: its parse is bounded (entry, decompressed-byte, sheet,
 * row, and cell caps for a workbook; input-byte, row, field-count, and field-length caps for delimited
 * text), a workbook's XML is rejected if it declares a DTD or entity, and every structural problem
 * surfaces as a structured {@link ExchangeError} (`WORKBOOK_INVALID`) that embeds no cell content,
 * path, or buffer.
 *
 * @packageDocumentation
 */

export { buildDelimited } from "./build-delimited.js";
export { buildWorkbook } from "./build-workbook.js";
export { type DelimitedFormat, delimitedFileName } from "./delimited-format.js";
export { DEFAULT_DELIMITED_LIMITS, type DelimitedLimits } from "./delimited-limits.js";
export { ExchangeError, type ExchangeErrorCode } from "./errors.js";
export { DEFAULT_WORKBOOK_LIMITS, type WorkbookLimits } from "./limits.js";
export {
  type ReadDelimitedInput,
  type ReadDelimitedOptions,
  readDelimited,
} from "./read-delimited.js";
export { type ReadWorkbookOptions, readWorkbook } from "./read-workbook.js";
export type {
  ReviewStatus,
  RowStatus,
  WorkbookData,
  WorkbookDuplicateKey,
  WorkbookModel,
  WorkbookRow,
  WorkbookRowProblem,
  WorkbookSheet,
} from "./types.js";
