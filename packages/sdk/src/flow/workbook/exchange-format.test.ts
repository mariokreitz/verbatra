import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXCHANGE_FORMAT,
  EXCHANGE_FORMATS,
  type ExchangeFormat,
  isDelimitedFormat,
} from "./exchange-format.js";

describe("EXCHANGE_FORMATS", () => {
  it("enumerates every format the type admits, workbook first", () => {
    expect(EXCHANGE_FORMATS).toEqual(["xlsx", "csv", "tsv"]);
  });

  it("has no duplicate member", () => {
    expect(new Set(EXCHANGE_FORMATS).size).toBe(EXCHANGE_FORMATS.length);
  });

  it("classifies every member as either the workbook or a delimited form", () => {
    const delimited = EXCHANGE_FORMATS.filter((format) => isDelimitedFormat(format));
    const workbook = EXCHANGE_FORMATS.filter((format) => !isDelimitedFormat(format));

    expect(delimited).toEqual(["csv", "tsv"]);
    expect(workbook).toEqual(["xlsx"]);
  });

  it("contains the default a caller gets when naming no format", () => {
    expect(EXCHANGE_FORMATS).toContain(DEFAULT_EXCHANGE_FORMAT);
  });

  it("accepts each member where an ExchangeFormat is required", () => {
    const accepted: ExchangeFormat[] = [...EXCHANGE_FORMATS];

    expect(accepted).toHaveLength(EXCHANGE_FORMATS.length);
  });
});
