import { describe, expect, it } from "vitest";
import { glossaryGetParamsSchema } from "./glossary.js";

describe("glossaryGetParamsSchema", () => {
  it("accepts an empty object", () => {
    expect(glossaryGetParamsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an object with any key present", () => {
    expect(glossaryGetParamsSchema.safeParse({ extra: true }).success).toBe(false);
  });
});
