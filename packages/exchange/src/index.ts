/**
 * Translator interchange for verbatra: a neutral, format-agnostic row model turned into a styled
 * `.xlsx` ({@link buildWorkbook}) and parsed back ({@link readWorkbook}). It is composed by
 * `@verbatra/sdk` and depends on none of `@verbatra/core`, `format-adapters`, `sdk`, or `cli`. It
 * runs no translation check and touches no locale or lock file.
 *
 * A returned workbook is untrusted: its parse is bounded (entry, decompressed-byte, sheet, row, and
 * cell caps) and its XML is rejected if it declares a DTD or entity, and every structural problem
 * surfaces as a structured {@link ExchangeError} (`WORKBOOK_INVALID`) that embeds no cell content,
 * path, or buffer.
 *
 * @packageDocumentation
 */

export { buildWorkbook } from "./build-workbook.js";
export { ExchangeError, type ExchangeErrorCode } from "./errors.js";
export { DEFAULT_WORKBOOK_LIMITS, type WorkbookLimits } from "./limits.js";
export { type ReadWorkbookOptions, readWorkbook } from "./read-workbook.js";
export type {
  RowStatus,
  WorkbookData,
  WorkbookModel,
  WorkbookRow,
  WorkbookSheet,
} from "./types.js";
