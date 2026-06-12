import { describe, expect, it } from "vitest";
import { checkPlaceholders } from "./integrity.js";

describe("checkPlaceholders", () => {
  it("matches identical placeholder sets in the same order", () => {
    const result = checkPlaceholders(["{a}", "{b}"], ["{a}", "{b}"]);
    expect(result).toEqual({ matches: true, missing: [], extra: [], reordered: false });
  });

  it("reports a missing placeholder", () => {
    const result = checkPlaceholders(["{a}", "{b}"], ["{a}"]);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{b}"]);
    expect(result.extra).toEqual([]);
  });

  it("reports an extra placeholder", () => {
    const result = checkPlaceholders(["{a}"], ["{a}", "{b}"]);
    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{b}"]);
    expect(result.missing).toEqual([]);
  });

  it("reports reordering when the set matches but order differs", () => {
    const result = checkPlaceholders(["{a}", "{b}"], ["{b}", "{a}"]);
    expect(result.matches).toBe(false);
    expect(result.reordered).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it("treats two empty sets as a match", () => {
    expect(checkPlaceholders([], []).matches).toBe(true);
  });

  it("does not throw on a mismatch", () => {
    expect(() => checkPlaceholders(["{a}"], ["{x}", "{y}"])).not.toThrow();
  });
});
