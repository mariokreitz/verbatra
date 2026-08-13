import { expect } from "vitest";
import { ExchangeError } from "./errors.js";
import type { WorkbookModel, WorkbookRow } from "./types.js";

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

export function singleLocaleModel(rows: readonly WorkbookRow[], locale = "de"): WorkbookModel {
  return { sheets: [{ locale, rows }] };
}

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
