/**
 * Translator interchange for verbatra: the workbook as a data artifact only. This package owns a
 * neutral, format-agnostic row model and turns it into a styled `.xlsx` ({@link buildWorkbook}) and
 * back ({@link readWorkbook}). It works over a neutral, format-agnostic row model and is composed
 * by `@verbatra/sdk`. It depends on none of `@verbatra/core`, `format-adapters`, `sdk`, or `cli`.
 * It runs no translation check and touches no locale or lock file: the SDK does that.
 *
 * The xlsx library (exceljs) is used in exactly two internal modules (build and read) and never
 * appears in this public surface. A returned workbook is untrusted input: its parse is bounded
 * (entry, decompressed-byte, sheet, row, and cell caps) and its XML is rejected if it declares a
 * DTD or entity, and every structural problem surfaces as a structured, secret-free
 * {@link ExchangeError} (`WORKBOOK_INVALID`) that never embeds cell content, a path, or a buffer.
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
