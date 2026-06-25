import { describe, expect, it } from "vitest";
import { isPluralKey, makePluralKey, pluralBaseKey, pluralCategoryOf } from "./plural.js";

describe("isPluralKey", () => {
  it("recognizes every CLDR plural category", () => {
    for (const category of ["zero", "one", "two", "few", "many", "other"]) {
      expect(isPluralKey(`items_${category}`)).toBe(true);
    }
  });

  it("does not treat ordinary keys as plural", () => {
    expect(isPluralKey("items")).toBe(false);
    expect(isPluralKey("submit")).toBe(false);
  });

  it("does not treat context suffixes as plural", () => {
    expect(isPluralKey("greeting_male")).toBe(false);
  });

  it("requires the suffix at the end with an underscore", () => {
    expect(isPluralKey("someone")).toBe(false);
    expect(isPluralKey("one_thing")).toBe(false);
  });
});

describe("pluralCategoryOf", () => {
  it("returns the encoded category for a plural key", () => {
    expect(pluralCategoryOf("items_one")).toBe("one");
    expect(pluralCategoryOf("a.b.items_other")).toBe("other");
  });

  it("returns undefined for a non-plural key", () => {
    expect(pluralCategoryOf("items")).toBeUndefined();
    expect(pluralCategoryOf("greeting_male")).toBeUndefined();
  });
});

describe("pluralBaseKey", () => {
  it("strips the CLDR suffix from a plural key", () => {
    expect(pluralBaseKey("items_one")).toBe("items");
    expect(pluralBaseKey("a.b.items_few")).toBe("a.b.items");
  });

  it("returns undefined for a non-plural key", () => {
    expect(pluralBaseKey("items")).toBeUndefined();
    expect(pluralBaseKey("greeting_male")).toBeUndefined();
  });
});

describe("makePluralKey", () => {
  it("composes a plural key from a base and a category", () => {
    expect(makePluralKey("items", "few")).toBe("items_few");
    expect(makePluralKey("a.b.items", "many")).toBe("a.b.items_many");
  });

  it("round-trips with pluralBaseKey and pluralCategoryOf", () => {
    const key = makePluralKey("items", "many");
    expect(pluralBaseKey(key)).toBe("items");
    expect(pluralCategoryOf(key)).toBe("many");
  });
});
