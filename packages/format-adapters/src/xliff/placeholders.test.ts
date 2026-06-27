import { describe, expect, it } from "vitest";
import { extractXliffPlaceholders } from "./placeholders.js";

describe("extractXliffPlaceholders", () => {
  it("extracts single-brace text interpolation", () => {
    expect(extractXliffPlaceholders("Hello {name}, you have {count} items")).toEqual([
      "{name}",
      "{count}",
    ]);
  });

  it("extracts inline placeholder element opening tags by their id-bearing tag", () => {
    expect(extractXliffPlaceholders('Click <x id="1"/> then <g id="2">here</g>')).toEqual([
      '<x id="1"/>',
      '<g id="2">',
    ]);
  });

  it("does not match an element whose name merely starts with a placeholder letter", () => {
    expect(extractXliffPlaceholders("<source>plain</source>")).toEqual([]);
  });

  it("preserves document order and multiplicity across the two token kinds", () => {
    expect(extractXliffPlaceholders('{a} <ph id="p"/> {a}')).toEqual([
      "{a}",
      '<ph id="p"/>',
      "{a}",
    ]);
  });

  it("returns an empty array for plain text", () => {
    expect(extractXliffPlaceholders("no placeholders here")).toEqual([]);
  });
});
