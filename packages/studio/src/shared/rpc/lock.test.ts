import { describe, expect, it } from "vitest";
import { lockStateParamsSchema } from "./lock.js";

describe("lockStateParamsSchema", () => {
  it("accepts an empty object", () => {
    expect(lockStateParamsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an object with any key present", () => {
    expect(lockStateParamsSchema.safeParse({ extra: true }).success).toBe(false);
  });
});
