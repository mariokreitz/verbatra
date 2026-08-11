import { describe, expect, it } from "vitest";
import { DELIMITER, delimitedFileName } from "./delimited-format.js";
import { ExchangeError } from "./errors.js";

describe("DELIMITER", () => {
  it("separates csv with a comma and tsv with a tab", () => {
    expect(DELIMITER.csv).toBe(",");
    expect(DELIMITER.tsv).toBe("\t");
  });
});

describe("delimitedFileName", () => {
  it("names one file per locale with the format as its extension", () => {
    expect(delimitedFileName("de", "csv")).toBe("de.csv");
    expect(delimitedFileName("pt-BR", "tsv")).toBe("pt-BR.tsv");
    expect(delimitedFileName("zh_Hans", "csv")).toBe("zh_Hans.csv");
  });

  it.each(["", ".", "..", "de/../etc", "de\\etc", "a:b"])(
    "rejects %j as a structured WORKBOOK_INVALID",
    (locale) => {
      const call = () => delimitedFileName(locale, "csv");
      expect(call).toThrow(ExchangeError);
      expect(call).toThrow(/cannot be an interchange file name/);
    },
  );
  it("rejects a locale carrying a control character", () => {
    const call = () => delimitedFileName(`de${String.fromCharCode(1)}`, "csv");
    expect(call).toThrow(ExchangeError);
    expect(call).toThrow(/cannot be an interchange file name/);
  });
});
