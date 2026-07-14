import { describe, expect, it } from "vitest";
import { statusCheckParamsSchema } from "./check.js";

describe("statusCheckParamsSchema", () => {
  it("accepts an omitted locales field", () => {
    expect(statusCheckParamsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a non-empty locales array", () => {
    expect(statusCheckParamsSchema.safeParse({ locales: ["de", "fr"] }).success).toBe(true);
  });

  it("rejects an empty locales array", () => {
    expect(statusCheckParamsSchema.safeParse({ locales: [] }).success).toBe(false);
  });

  it("rejects an empty-string element", () => {
    expect(statusCheckParamsSchema.safeParse({ locales: [""] }).success).toBe(false);
  });

  it("rejects an unknown extra key", () => {
    expect(statusCheckParamsSchema.safeParse({ locales: ["de"], extra: true }).success).toBe(false);
  });
});
