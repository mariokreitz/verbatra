import { describe, expect, it } from "vitest";
import { historyListParamsSchema } from "./history.js";

describe("historyListParamsSchema", () => {
  it("accepts an omitted limit", () => {
    expect(historyListParamsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a positive integer limit", () => {
    expect(historyListParamsSchema.safeParse({ limit: 5 }).success).toBe(true);
  });

  it("rejects a zero limit", () => {
    expect(historyListParamsSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it("rejects a negative limit", () => {
    expect(historyListParamsSchema.safeParse({ limit: -1 }).success).toBe(false);
  });

  it("rejects a non-integer limit", () => {
    expect(historyListParamsSchema.safeParse({ limit: 1.5 }).success).toBe(false);
  });

  it("rejects an unknown extra key", () => {
    expect(historyListParamsSchema.safeParse({ limit: 5, extra: true }).success).toBe(false);
  });
});
