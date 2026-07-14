import { describe, expect, it } from "vitest";
import { isRtlLocale } from "./locale-direction.js";

describe("isRtlLocale", () => {
  it("recognizes every known right-to-left base subtag", () => {
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("he")).toBe(true);
    expect(isRtlLocale("fa")).toBe(true);
    expect(isRtlLocale("ur")).toBe(true);
  });

  it("matches a regional variant by its primary subtag, hyphen or underscore separated", () => {
    expect(isRtlLocale("ar-EG")).toBe(true);
    expect(isRtlLocale("he_IL")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isRtlLocale("AR")).toBe(true);
    expect(isRtlLocale("Ar-SA")).toBe(true);
  });

  it("returns false for a left-to-right locale", () => {
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("de-DE")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isRtlLocale("")).toBe(false);
  });
});
