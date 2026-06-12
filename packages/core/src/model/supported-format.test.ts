import { describe, expect, it } from "vitest";
import { SUPPORTED_FORMATS, supportedFormatSchema } from "./supported-format.js";

describe("SupportedFormat", () => {
  it("enumerates at least the v1 JSON formats", () => {
    expect(SUPPORTED_FORMATS).toContain("i18next-json");
    expect(SUPPORTED_FORMATS).toContain("vue-i18n-json");
    expect(SUPPORTED_FORMATS).toContain("next-intl-json");
  });

  it("accepts a known format", () => {
    expect(supportedFormatSchema.parse("i18next-json")).toBe("i18next-json");
  });

  it("rejects a non-v1 format", () => {
    expect(supportedFormatSchema.safeParse("xliff-1.2").success).toBe(false);
  });
});
