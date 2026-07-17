import { describe, expect, it } from "vitest";
import { filterReviewRows, uniqueReviewLocales } from "./review-filter.js";
import type { ReviewQueueRow } from "./review-queue-data.js";

function row(locale: string, key: string): ReviewQueueRow {
  return { locale, key, reasons: ["EQUALS_SOURCE"] };
}

const ROWS: readonly ReviewQueueRow[] = [
  row("de", "home.title"),
  row("fr", "home.title"),
  row("de", "checkout.cta"),
  row("ar", "home.subtitle"),
];

describe("uniqueReviewLocales", () => {
  it("returns each locale once, sorted", () => {
    expect(uniqueReviewLocales(ROWS)).toEqual(["ar", "de", "fr"]);
  });

  it("is empty for no rows", () => {
    expect(uniqueReviewLocales([])).toEqual([]);
  });
});

describe("filterReviewRows", () => {
  it("returns the rows unchanged for the empty filter", () => {
    expect(filterReviewRows(ROWS, { locale: null, query: "" })).toEqual(ROWS);
  });

  it("pins an exact locale", () => {
    expect(filterReviewRows(ROWS, { locale: "de", query: "" })).toEqual([
      row("de", "home.title"),
      row("de", "checkout.cta"),
    ]);
  });

  it("matches the key case-insensitively as a substring", () => {
    expect(filterReviewRows(ROWS, { locale: null, query: "HOME" })).toEqual([
      row("de", "home.title"),
      row("fr", "home.title"),
      row("ar", "home.subtitle"),
    ]);
  });

  it("treats whitespace-only queries as no filter", () => {
    expect(filterReviewRows(ROWS, { locale: null, query: "   " })).toEqual(ROWS);
  });

  it("combines the locale pin and the key query", () => {
    expect(filterReviewRows(ROWS, { locale: "de", query: "title" })).toEqual([
      row("de", "home.title"),
    ]);
  });

  it("can produce an empty result the caller renders as a no-matches state", () => {
    expect(filterReviewRows(ROWS, { locale: "fr", query: "checkout" })).toEqual([]);
  });
});
