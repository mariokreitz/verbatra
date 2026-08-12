import { describe, expect, it } from "vitest";
import { baseConfig } from "../test-support.js";
import { verbatraConfigSchema } from "./schema.js";

describe("verbatraConfigSchema: targetLocales case-insensitive duplicates", () => {
  it("accepts distinct, case-insensitively-unique target locales", () => {
    const result = verbatraConfigSchema.safeParse(
      baseConfig({ targetLocales: ["de", "fr", "it"] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects two target locales differing only in case", () => {
    const result = verbatraConfigSchema.safeParse(baseConfig({ targetLocales: ["de", "DE"] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "targetLocales");
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("DE");
    }
  });

  it("rejects two identical target locales", () => {
    const result = verbatraConfigSchema.safeParse(baseConfig({ targetLocales: ["de", "de"] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "targetLocales");
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("de");
    }
  });

  it("rejects three-or-more-way case collisions, naming the first repeat", () => {
    const result = verbatraConfigSchema.safeParse(
      baseConfig({ targetLocales: ["de", "fr", "De"] }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "targetLocales");
      expect(issue?.message).toContain("De");
    }
  });
});

describe("verbatraConfigSchema: files.localeStyle", () => {
  it("accepts a config that omits it, which is every config written before styles existed", () => {
    const result = verbatraConfigSchema.safeParse(baseConfig());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files.localeStyle).toBeUndefined();
    }
  });

  it.each(["literal", "posix", "android"])("accepts the %s style", (style) => {
    const result = verbatraConfigSchema.safeParse(
      baseConfig({ files: { pattern: "locales/{locale}.json", localeStyle: style as "literal" } }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an unknown style", () => {
    const result = verbatraConfigSchema.safeParse(
      baseConfig({
        files: { pattern: "locales/{locale}.json", localeStyle: "apple" as "literal" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("still requires the locale token in the pattern", () => {
    const result = verbatraConfigSchema.safeParse(
      baseConfig({ files: { pattern: "locales/common.json", localeStyle: "android" } }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts the android source pattern, whose token expands to the default directory", () => {
    const result = verbatraConfigSchema.safeParse(
      baseConfig({ files: { pattern: "res/{locale}/strings.xml", localeStyle: "android" } }),
    );
    expect(result.success).toBe(true);
  });
});
