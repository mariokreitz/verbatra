import { describe, expect, it } from "vitest";
import { SUPPORTED_FORMATS, supportedFormatSchema } from "./supported-format.js";

describe("SupportedFormat", () => {
  it("enumerates the JSON i18n formats", () => {
    expect(SUPPORTED_FORMATS).toContain("i18next-json");
    expect(SUPPORTED_FORMATS).toContain("vue-i18n-json");
    expect(SUPPORTED_FORMATS).toContain("next-intl-json");
    expect(SUPPORTED_FORMATS).toContain("ngx-translate-json");
  });

  it("enumerates the non-JSON formats (XLIFF, YAML, ARB, properties)", () => {
    expect(SUPPORTED_FORMATS).toContain("xliff");
    expect(SUPPORTED_FORMATS).toContain("yaml");
    expect(SUPPORTED_FORMATS).toContain("arb");
    expect(SUPPORTED_FORMATS).toContain("properties");
  });

  it("accepts a known format", () => {
    expect(supportedFormatSchema.parse("i18next-json")).toBe("i18next-json");
  });

  it("accepts each new format through the schema", () => {
    expect(supportedFormatSchema.parse("xliff")).toBe("xliff");
    expect(supportedFormatSchema.parse("yaml")).toBe("yaml");
    expect(supportedFormatSchema.parse("arb")).toBe("arb");
    expect(supportedFormatSchema.parse("properties")).toBe("properties");
  });

  it("rejects an unknown format", () => {
    expect(supportedFormatSchema.safeParse("xliff-1.2").success).toBe(false);
  });
});
