import { describe, expect, it } from "vitest";
import { stableStringHash } from "./string-hash.js";

describe("stableStringHash", () => {
  it("returns a 16-character lowercase hex digest", () => {
    expect(stableStringHash("verbatra")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for the same input", () => {
    expect(stableStringHash("hello world")).toBe(stableStringHash("hello world"));
  });

  it("differs for different input", () => {
    expect(stableStringHash("a")).not.toBe(stableStringHash("b"));
  });

  it("hashes the empty string to the FNV offset basis", () => {
    expect(stableStringHash("")).toBe("cbf29ce484222325");
  });

  it("is sensitive to input order", () => {
    expect(stableStringHash("ab")).not.toBe(stableStringHash("ba"));
  });
});
