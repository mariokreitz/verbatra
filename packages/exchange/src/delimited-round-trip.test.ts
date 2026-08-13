import { describe, expect, it } from "vitest";
import { buildDelimited } from "./build-delimited.js";
import { DELIMITER, type DelimitedFormat } from "./delimited-format.js";
import { readDelimited } from "./read-delimited.js";
import type { WorkbookSheet } from "./types.js";

const sheet: WorkbookSheet = {
  locale: "de",
  rows: [
    {
      key: "greeting",
      source: "Hello, {name}",
      currentTarget: 'He said "hi"',
      status: "new",
      sourceHash: "abc123",
      translation: "Hallo, {name}",
      context: "Line one\nLine two",
      reviewStatus: "ok",
      reviewReasons: "",
    },
    {
      key: "padded",
      source: "  leading and trailing  ",
      currentTarget: "tab\tseparated",
      status: "changed",
      sourceHash: "def456",
      translation: 'Er sagte "hallo"',
      context: "windows\r\nline",
      reviewStatus: "review",
      reviewReasons: "length-ratio-outlier, equals-source",
    },
    {
      key: "empty",
      source: "",
      currentTarget: "",
      status: "unchanged",
      sourceHash: "ghi789",
      translation: "",
      context: "",
      reviewStatus: "ok",
      reviewReasons: "",
    },
  ],
};

const FORMATS: readonly DelimitedFormat[] = ["csv", "tsv"];

describe("buildDelimited + readDelimited round trip", () => {
  it.each(FORMATS)("%s serializes and parses back to an equal sheet", (format) => {
    const data = readDelimited({
      text: buildDelimited(sheet, format),
      locale: sheet.locale,
      format,
    });
    expect(data.sheets).toEqual([sheet]);
    expect(data.malformedRows).toEqual([]);
    expect(data.duplicateKeys).toEqual([]);
  });

  it.each(FORMATS)("%s round-trips a locale with no rows", (format) => {
    const empty: WorkbookSheet = { locale: "fr", rows: [] };
    const data = readDelimited({ text: buildDelimited(empty, format), locale: "fr", format });
    expect(data.sheets).toEqual([empty]);
  });
});

const COERCION_PRONE_TRANSLATIONS: readonly string[] = [
  "007",
  "1.10",
  "3/4",
  "1234567890123456",
  "true",
  "=> siehe Hinweis",
  "+49 30 1234567",
  "-5 Grad",
  "@mention this",
  "=1+1",
  "=cmd|'/c calc'!A1",
  "'=1+1",
  "''=1+1",
  "'tis a quote",
  "'",
];

describe("buildDelimited + readDelimited round trip: coercion-prone translations", () => {
  it.each(COERCION_PRONE_TRANSLATIONS)("imports %j verbatim", (translation) => {
    const one: WorkbookSheet = {
      locale: "de",
      rows: [
        {
          key: "value",
          source: "Source",
          currentTarget: "",
          status: "new",
          sourceHash: "abc123",
          translation,
          context: "",
          reviewStatus: "ok",
          reviewReasons: "",
        },
      ],
    };
    const data = readDelimited({ text: buildDelimited(one, "csv"), locale: "de", format: "csv" });
    expect(data.sheets[0]?.rows[0]?.translation).toBe(translation);
  });
});

describe("buildDelimited + readDelimited round trip: formula-shaped values in every column", () => {
  it.each(FORMATS)("%s restores every neutralized column to its original text", (format) => {
    const hostile: WorkbookSheet = {
      locale: "de",
      rows: [
        {
          key: "risky",
          source: "=1+1",
          currentTarget: "+49",
          status: "new",
          sourceHash: "abc123",
          translation: "-5 Grad",
          context: "@mention, with a delimiter",
          reviewStatus: "ok",
          reviewReasons: "",
        },
      ],
    };
    const text = buildDelimited(hostile, format);
    const delimiter = DELIMITER[format];
    expect(text).toContain(`${delimiter}'=1+1${delimiter}`);
    expect(text).toContain(`${delimiter}'-5 Grad${delimiter}`);
    const data = readDelimited({ text, locale: "de", format });
    expect(data.sheets).toEqual([hostile]);
  });
});
