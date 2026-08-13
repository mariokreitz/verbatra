import { describe, expect, it } from "vitest";
import { toUsage } from "./usage.js";

describe("toUsage", () => {
  it("returns a Usage when both counts are numbers", () => {
    expect(toUsage(12, 7)).toEqual({ inputTokens: 12, outputTokens: 7 });
  });

  it("returns undefined when the input count is missing", () => {
    expect(toUsage(undefined, 7)).toBeUndefined();
  });

  it("returns undefined when the output count is missing", () => {
    expect(toUsage(12, undefined)).toBeUndefined();
  });

  it("returns undefined when both counts are missing", () => {
    expect(toUsage(undefined, undefined)).toBeUndefined();
  });

  it("treats a zero count as a reported number, not as missing", () => {
    expect(toUsage(0, 0)).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
