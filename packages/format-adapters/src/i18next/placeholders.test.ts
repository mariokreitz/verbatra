import { describe, expect, it } from "vitest";
import { extractI18nextPlaceholders } from "./placeholders.js";

describe("extractI18nextPlaceholders", () => {
  it("extracts a single placeholder verbatim", () => {
    expect(extractI18nextPlaceholders("Hello {{name}}")).toEqual(["{{name}}"]);
  });

  it("extracts multiple placeholders in order", () => {
    expect(extractI18nextPlaceholders("{{a}} and {{b}}")).toEqual(["{{a}}", "{{b}}"]);
  });

  it("returns an empty array when there are no placeholders", () => {
    expect(extractI18nextPlaceholders("plain text")).toEqual([]);
  });

  it("deduplicates repeated placeholders, keeping first-appearance order", () => {
    expect(extractI18nextPlaceholders("{{count}} of {{count}}")).toEqual(["{{count}}"]);
  });

  it("keeps formatted placeholders verbatim", () => {
    expect(extractI18nextPlaceholders("{{val, number}}")).toEqual(["{{val, number}}"]);
  });
});
