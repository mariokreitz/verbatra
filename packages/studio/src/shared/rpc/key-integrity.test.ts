import { describe, expect, it } from "vitest";
import { keyIntegrityParamsSchema } from "./key-integrity.js";

describe("keyIntegrityParamsSchema", () => {
  it("accepts a key with an omitted locales field", () => {
    expect(keyIntegrityParamsSchema.safeParse({ key: "greeting" }).success).toBe(true);
  });

  it("accepts a key with a non-empty locales array", () => {
    expect(
      keyIntegrityParamsSchema.safeParse({ key: "greeting", locales: ["de", "fr"] }).success,
    ).toBe(true);
  });

  it("rejects a missing key", () => {
    expect(keyIntegrityParamsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty-string key", () => {
    expect(keyIntegrityParamsSchema.safeParse({ key: "" }).success).toBe(false);
  });

  it("rejects an empty locales array", () => {
    expect(keyIntegrityParamsSchema.safeParse({ key: "greeting", locales: [] }).success).toBe(
      false,
    );
  });

  it("rejects an empty-string locale element", () => {
    expect(keyIntegrityParamsSchema.safeParse({ key: "greeting", locales: [""] }).success).toBe(
      false,
    );
  });

  it("rejects an unknown extra key", () => {
    expect(keyIntegrityParamsSchema.safeParse({ key: "greeting", extra: true }).success).toBe(
      false,
    );
  });
});
