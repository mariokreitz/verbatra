import { expect } from "vitest";
import { ExchangeError } from "./errors.js";
import type { WorkbookModel, WorkbookRow } from "./types.js";

/**
 * A well-formed {@link WorkbookRow} with sensible defaults, in the style of
 * build-delimited.test.ts's own `row()`. Override only the fields a test cares about, so the
 * assertions that follow stay next to the values they check rather than pointing at a fixture
 * defined elsewhere.
 */
export function row(overrides: Partial<WorkbookRow> = {}): WorkbookRow {
  return {
    key: "greeting",
    source: "Hello",
    currentTarget: "",
    status: "new",
    sourceHash: "abc123",
    translation: "",
    context: "",
    reviewStatus: "ok",
    reviewReasons: "",
    ...overrides,
  };
}

/** A {@link WorkbookModel} carrying one target locale's rows, the shape most build/read tests need. */
export function singleLocaleModel(rows: readonly WorkbookRow[], locale = "de"): WorkbookModel {
  return { sheets: [{ locale, rows }] };
}

/**
 * Translation values a spreadsheet may coerce, misparse, or evaluate as a formula when it opens the
 * file: a leading-zero code, a trailing-zero decimal, a slash date, a long numeric id, a
 * boolean-looking word, and each of the leading characters (=, +, -, @) a spreadsheet treats as the
 * start of a formula. Shared by the xlsx and delimited round-trip suites, which each protect against
 * this differently and document their own rationale next to their assertions.
 */
export const COERCION_PRONE_TRANSLATIONS: readonly string[] = [
  "007",
  "1.10",
  "3/4",
  "1234567890123456",
  "true",
  "=> siehe Hinweis",
  "+49 30 1234567",
  "-5 Grad",
  "@mention this",
];

/**
 * Run `action`, and assert whatever it throws or rejects with is a structured {@link ExchangeError}
 * carrying the `WORKBOOK_INVALID` code, failing the test if it neither throws nor rejects. Works for
 * both a synchronously throwing call (readDelimited) and an asynchronously rejecting one (readWorkbook,
 * buildWorkbook, guardWorkbookBytes), since `action` is invoked inside the `try` before its result, if
 * any, is awaited.
 *
 * Returns the caught error so a test that needs to inspect more than the code (for example, that a
 * message names the offending locale) still can.
 */
export async function expectWorkbookInvalid(action: () => unknown): Promise<ExchangeError> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
    return error as ExchangeError;
  }
  throw new Error("expected the operation to throw or reject a WORKBOOK_INVALID error");
}
