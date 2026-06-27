import { describe, expect, it } from "vitest";
import { DEFAULT_WORKBOOK_LIMITS, type WorkbookLimits } from "./limits.js";

const CAP_KEYS: readonly (keyof WorkbookLimits)[] = [
  "maxDecompressedBytes",
  "maxEntryCount",
  "maxSheetCount",
  "maxRowsPerSheet",
  "maxCellsPerRow",
];

describe("DEFAULT_WORKBOOK_LIMITS", () => {
  it("declares exactly the five workbook caps", () => {
    expect(Object.keys(DEFAULT_WORKBOOK_LIMITS).sort()).toEqual([...CAP_KEYS].sort());
  });

  it("sets every cap to a positive finite integer", () => {
    for (const key of CAP_KEYS) {
      const value = DEFAULT_WORKBOOK_LIMITS[key];
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it("bounds the decompressed size to roughly the SDK on-disk order (64 MiB)", () => {
    expect(DEFAULT_WORKBOOK_LIMITS.maxDecompressedBytes).toBe(64 * 1024 * 1024);
  });
});
