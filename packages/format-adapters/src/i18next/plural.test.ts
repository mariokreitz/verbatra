import { describe, expect, it } from "vitest";
import { isPluralKey } from "./plural.js";

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
