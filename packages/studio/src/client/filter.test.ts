import { describe, expect, it } from "vitest";
import { filterAndCapKeys, MAX_RENDERED_KEYS } from "./filter.js";

function keysNamed(count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => `key.${index.toString().padStart(6, "0")}`);
}

describe("filterAndCapKeys", () => {
  it("returns an empty result for an empty list", () => {
    const result = filterAndCapKeys([], "");

    expect(result).toEqual({ items: [], totalMatches: 0, truncated: false });
  });

  it("does not truncate a list of exactly the cap size", () => {
    const keys = keysNamed(MAX_RENDERED_KEYS);

    const result = filterAndCapKeys(keys, "");

    expect(result.items).toEqual(keys);
    expect(result.totalMatches).toBe(MAX_RENDERED_KEYS);
    expect(result.truncated).toBe(false);
  });

  it("truncates a list one over the cap size, keeping the first 500 in order", () => {
    const keys = keysNamed(MAX_RENDERED_KEYS + 1);

    const result = filterAndCapKeys(keys, "");

    expect(result.items).toEqual(keys.slice(0, MAX_RENDERED_KEYS));
    expect(result.items).toHaveLength(MAX_RENDERED_KEYS);
    expect(result.totalMatches).toBe(MAX_RENDERED_KEYS + 1);
    expect(result.truncated).toBe(true);
  });

  it("filters over the full list before capping, not a pre-truncated prefix", () => {
    const keys = [...keysNamed(MAX_RENDERED_KEYS), "needle.only.match"];

    const result = filterAndCapKeys(keys, "needle");

    expect(result.items).toEqual(["needle.only.match"]);
    expect(result.totalMatches).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("matches case-insensitively", () => {
    const result = filterAndCapKeys(["Greeting.Hello", "farewell.bye"], "GREETING");

    expect(result.items).toEqual(["Greeting.Hello"]);
  });

  it("treats a blank or whitespace-only query as no filter", () => {
    const keys = ["b.key", "a.key"];

    expect(filterAndCapKeys(keys, "")).toEqual({
      items: keys,
      totalMatches: 2,
      truncated: false,
    });
    expect(filterAndCapKeys(keys, "   ")).toEqual({
      items: keys,
      totalMatches: 2,
      truncated: false,
    });
  });

  it("preserves input order among matches, never re-sorting", () => {
    const keys = ["zebra.one", "apple.one", "mango.one"];

    const result = filterAndCapKeys(keys, "one");

    expect(result.items).toEqual(["zebra.one", "apple.one", "mango.one"]);
  });
});
