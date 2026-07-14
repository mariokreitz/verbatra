import { describe, expect, it } from "vitest";
import { combineUsage, createUsageAccumulator, foldUsage } from "./usage.js";

describe("createUsageAccumulator / foldUsage", () => {
  it("starts undefined and stays undefined when nothing is folded in", () => {
    const acc = createUsageAccumulator();
    expect(acc.total).toBeUndefined();
  });

  it("stays undefined when only absent usage is folded in", () => {
    const acc = createUsageAccumulator();
    foldUsage(acc, undefined);
    foldUsage(acc, undefined);
    expect(acc.total).toBeUndefined();
  });

  it("becomes defined on the first real usage, never a fabricated zero before that", () => {
    const acc = createUsageAccumulator();
    foldUsage(acc, { inputTokens: 10, outputTokens: 5 });
    expect(acc.total).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("sums across multiple folds, absent ones contributing nothing in between", () => {
    const acc = createUsageAccumulator();
    foldUsage(acc, { inputTokens: 10, outputTokens: 5 });
    foldUsage(acc, undefined);
    foldUsage(acc, { inputTokens: 3, outputTokens: 7 });
    expect(acc.total).toEqual({ inputTokens: 13, outputTokens: 12 });
  });
});

describe("combineUsage", () => {
  it("returns undefined when both sides are undefined", () => {
    expect(combineUsage(undefined, undefined)).toBeUndefined();
  });

  it("returns the defined side unchanged when the other is undefined", () => {
    const usage = { inputTokens: 1, outputTokens: 2 };
    expect(combineUsage(usage, undefined)).toEqual(usage);
    expect(combineUsage(undefined, usage)).toEqual(usage);
  });

  it("sums both sides when both are defined", () => {
    expect(
      combineUsage({ inputTokens: 1, outputTokens: 2 }, { inputTokens: 3, outputTokens: 4 }),
    ).toEqual({
      inputTokens: 4,
      outputTokens: 6,
    });
  });
});
