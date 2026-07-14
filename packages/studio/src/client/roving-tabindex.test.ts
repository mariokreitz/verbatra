import { describe, expect, it } from "vitest";
import { nextRovingIndex } from "./roving-tabindex.js";

describe("nextRovingIndex", () => {
  it("returns null for an unhandled key", () => {
    expect(nextRovingIndex(0, "Enter", 3)).toBeNull();
  });

  it("returns null when itemCount is zero", () => {
    expect(nextRovingIndex(0, "ArrowDown", 0)).toBeNull();
  });

  it("returns null when itemCount is negative", () => {
    expect(nextRovingIndex(0, "ArrowDown", -1)).toBeNull();
  });

  it("moves forward on ArrowDown", () => {
    expect(nextRovingIndex(0, "ArrowDown", 3)).toBe(1);
  });

  it("moves forward on ArrowRight", () => {
    expect(nextRovingIndex(1, "ArrowRight", 3)).toBe(2);
  });

  it("wraps forward from the last item to the first", () => {
    expect(nextRovingIndex(2, "ArrowDown", 3)).toBe(0);
  });

  it("moves backward on ArrowUp", () => {
    expect(nextRovingIndex(2, "ArrowUp", 3)).toBe(1);
  });

  it("moves backward on ArrowLeft", () => {
    expect(nextRovingIndex(1, "ArrowLeft", 3)).toBe(0);
  });

  it("wraps backward from the first item to the last", () => {
    expect(nextRovingIndex(0, "ArrowUp", 3)).toBe(2);
  });

  it("jumps to the first item on Home", () => {
    expect(nextRovingIndex(2, "Home", 3)).toBe(0);
  });

  it("jumps to the last item on End", () => {
    expect(nextRovingIndex(0, "End", 3)).toBe(2);
  });

  it("handles a single-item list without an infinite or out-of-range index", () => {
    expect(nextRovingIndex(0, "ArrowDown", 1)).toBe(0);
    expect(nextRovingIndex(0, "ArrowUp", 1)).toBe(0);
  });
});
