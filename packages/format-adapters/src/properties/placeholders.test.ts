import { checkPlaceholders } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { extractPropertiesPlaceholders } from "./placeholders.js";

describe("extractPropertiesPlaceholders", () => {
  it("extracts positional tokens in document order", () => {
    expect(extractPropertiesPlaceholders("{0} then {1}")).toEqual(["{0}", "{1}"]);
  });

  it("extracts named tokens and normalizes inner whitespace", () => {
    expect(extractPropertiesPlaceholders("Hi { name }")).toEqual(["{name}"]);
  });

  it("preserves every occurrence as a multiset, not deduplicated", () => {
    expect(extractPropertiesPlaceholders("{0} of {0}")).toEqual(["{0}", "{0}"]);
  });

  it("returns an empty array for a value with no interpolation", () => {
    expect(extractPropertiesPlaceholders("plain text")).toEqual([]);
  });

  it("does not treat double-brace text as a placeholder", () => {
    expect(extractPropertiesPlaceholders("{{count}}")).toEqual([]);
  });

  it("rejects a dropped repeated occurrence through the integrity check", () => {
    const source = extractPropertiesPlaceholders("{0} of {0}");
    const translated = extractPropertiesPlaceholders("{0} total");
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{0}"]);
  });

  it("rejects a duplicated token through the integrity check", () => {
    const source = extractPropertiesPlaceholders("{0} apples");
    const translated = extractPropertiesPlaceholders("{0} and {0} apples");
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{0}"]);
  });

  it("accepts a faithful translation that preserves every occurrence", () => {
    const source = extractPropertiesPlaceholders("{0} of {0}");
    const translated = extractPropertiesPlaceholders("{0} von {0}");
    expect(checkPlaceholders(source, translated).matches).toBe(true);
  });
});
