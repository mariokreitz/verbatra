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
