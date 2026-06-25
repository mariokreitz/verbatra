import { describe, expect, it } from "vitest";
import { extractVueI18nPlaceholders } from "./placeholders.js";

describe("extractVueI18nPlaceholders", () => {
  it("extracts a single named placeholder", () => {
    expect(extractVueI18nPlaceholders("hello {name}")).toEqual(["{name}"]);
  });

  it("extracts list-interpolation placeholders", () => {
    expect(extractVueI18nPlaceholders("{0} and {1}")).toEqual(["{0}", "{1}"]);
  });

  it("preserves every occurrence of a repeated placeholder in document order", () => {
    // Multiplicity matters: integrity is a multiset check, so a dropped occurrence
    // must be detectable. Collapsing duplicates here would hide that.
    expect(extractVueI18nPlaceholders("{count} of {count}")).toEqual(["{count}", "{count}"]);
  });

  it("returns an empty array when there is no interpolation", () => {
    expect(extractVueI18nPlaceholders("plain text")).toEqual([]);
  });

  it("does not treat linked messages as placeholders", () => {
    expect(extractVueI18nPlaceholders("see @:other.key for details")).toEqual([]);
  });

  it("extracts across pipe-separated plural forms", () => {
    expect(extractVueI18nPlaceholders("no apples | one apple | {count} apples")).toEqual([
      "{count}",
    ]);
  });

  it("stays linear on adversarial input", () => {
    const hostile = "{".repeat(200_000);
    const start = Date.now();
    const result = extractVueI18nPlaceholders(hostile);
    expect(result).toEqual([]);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
