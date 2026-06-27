import { describe, expect, it } from "vitest";
import { decodeKeyToSegments, encodeSegment, joinEncodedSegments } from "./key-encoding.js";

describe("encodeSegment", () => {
  it("returns a segment with no dot or backslash unchanged (the no-op fast path)", () => {
    expect(encodeSegment("plain")).toBe("plain");
    expect(encodeSegment("")).toBe("");
    expect(encodeSegment("with space and {{x}}")).toBe("with space and {{x}}");
  });

  it("escapes a literal dot", () => {
    expect(encodeSegment("foo.bar")).toBe("foo\\.bar");
    expect(encodeSegment("a.b.c")).toBe("a\\.b\\.c");
  });

  it("escapes a literal backslash", () => {
    expect(encodeSegment("a\\b")).toBe("a\\\\b");
  });

  it("escapes a segment containing both a dot and a backslash", () => {
    expect(encodeSegment("a.b\\c")).toBe("a\\.b\\\\c");
  });
});

describe("joinEncodedSegments + decodeKeyToSegments round-trip", () => {
  const cases: readonly (readonly string[])[] = [
    ["plain"],
    ["a", "b", "c"],
    ["foo.bar"],
    ["a.b.c"],
    ["a\\b"],
    ["a.b\\c"],
    ["nested", "leaf.with.dots"],
    ["", "empty-first"],
    ["__proto__"],
    ["a.b", "c"],
  ];

  for (const segments of cases) {
    it(`recovers ${JSON.stringify(segments)} exactly`, () => {
      const key = joinEncodedSegments(segments.map(encodeSegment));
      expect(decodeKeyToSegments(key)).toEqual([...segments]);
    });
  }
});

describe("decodeKeyToSegments compatibility", () => {
  it("splits a backslash-free key on plain dots, matching the legacy split", () => {
    expect(decodeKeyToSegments("a.b.c")).toEqual(["a", "b", "c"]);
    expect(decodeKeyToSegments("plain")).toEqual(["plain"]);
  });

  it("distinguishes a literal dotted leaf from a nested path", () => {
    expect(decodeKeyToSegments("foo\\.bar")).toEqual(["foo.bar"]);
    expect(decodeKeyToSegments("foo.bar")).toEqual(["foo", "bar"]);
  });

  it("does not throw on a malformed trailing escape (never produced by encodeSegment)", () => {
    expect(() => decodeKeyToSegments("a\\")).not.toThrow();
    expect(decodeKeyToSegments("a\\")).toEqual(["a"]);
  });
});
