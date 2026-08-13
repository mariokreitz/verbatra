import { describe, expect, it } from "vitest";
import { DEFAULT_DELIMITED_LIMITS, type DelimitedLimits } from "./delimited-limits.js";

const CAP_KEYS: readonly (keyof DelimitedLimits)[] = [
  "maxInputBytes",
  "maxRowsPerFile",
  "maxFieldsPerRow",
  "maxFieldLength",
];

describe("DEFAULT_DELIMITED_LIMITS", () => {
  it("declares exactly the four delimited caps", () => {
    expect(Object.keys(DEFAULT_DELIMITED_LIMITS).sort()).toEqual([...CAP_KEYS].sort());
  });

  it("sets every cap to a positive finite integer", () => {
    for (const key of CAP_KEYS) {
      const value = DEFAULT_DELIMITED_LIMITS[key];
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it("bounds the input size to 32 MiB", () => {
    expect(DEFAULT_DELIMITED_LIMITS.maxInputBytes).toBe(32 * 1024 * 1024);
  });
});
