import { describe, expect, it } from "vitest";
import { statusDiffParamsSchema } from "./diff.js";

describe("statusDiffParamsSchema", () => {
  it("accepts an omitted locales field", () => {
    expect(statusDiffParamsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a non-empty locales array", () => {
    expect(statusDiffParamsSchema.safeParse({ locales: ["de", "fr"] }).success).toBe(true);
  });

  it("rejects an empty locales array", () => {
    expect(statusDiffParamsSchema.safeParse({ locales: [] }).success).toBe(false);
  });

  it("rejects an empty-string element", () => {
    expect(statusDiffParamsSchema.safeParse({ locales: [""] }).success).toBe(false);
  });

  it("rejects an unknown extra key", () => {
    expect(statusDiffParamsSchema.safeParse({ locales: ["de"], extra: true }).success).toBe(false);
  });
});
