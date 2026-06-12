import { describe, expect, it } from "vitest";
import { isPluralValue } from "./plural.js";

describe("isPluralValue", () => {
  it("is true for a pipe-separated plural value", () => {
    expect(isPluralValue("no apples | one apple | {count} apples")).toBe(true);
  });

  it("is false for a value with no pipe", () => {
    expect(isPluralValue("just one apple")).toBe(false);
  });

  it("is true for any bare pipe (vue-i18n's defined behavior)", () => {
    expect(isPluralValue("Search | Results")).toBe(true);
  });
});
