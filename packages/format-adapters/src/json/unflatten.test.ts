import type { TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { unflattenEntries } from "./unflatten.js";

function entry(key: string, value: string): TranslationEntry {
  return { key, namespace: "n", value, placeholders: [], isPlural: false };
}

function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("unflattenEntries", () => {
  it("merges sibling keys under a shared parent", () => {
    const tree = unflattenEntries(
      new Map([
        ["a.b", entry("a.b", "B")],
        ["a.c", entry("a.c", "C")],
      ]),
    );
    expect(plain(tree)).toEqual({ a: { b: "B", c: "C" } });
  });

  it("throws a structured error when a leaf collides with a nested path", () => {
    const entries = new Map([
      ["a", entry("a", "X")],
      ["a.b", entry("a.b", "Y")],
    ]);
    expect(() => unflattenEntries(entries)).toThrow(AdapterError);
  });

  it("treats a __proto__ segment as inert data without polluting prototypes", () => {
    const tree = unflattenEntries(new Map([["__proto__.x", entry("__proto__.x", "v")]]));
    expect(Object.getPrototypeOf(tree)).toBeNull();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(JSON.stringify(tree)).toBe('{"__proto__":{"x":"v"}}');
  });

  it("restores an encoded literal dotted leaf as a single leaf, not re-nested", () => {
    const tree = unflattenEntries(new Map([["foo\\.bar", entry("foo\\.bar", "Hi")]]));
    expect(plain(tree)).toEqual({ "foo.bar": "Hi" });
  });

  it("restores a multi-dot literal leaf in full", () => {
    const tree = unflattenEntries(new Map([["a\\.b\\.c", entry("a\\.b\\.c", "Hi")]]));
    expect(plain(tree)).toEqual({ "a.b.c": "Hi" });
  });

  it("keeps an encoded literal leaf and a sibling nested path distinct", () => {
    const tree = unflattenEntries(
      new Map([
        ["a\\.b", entry("a\\.b", "x")],
        ["c.d", entry("c.d", "y")],
      ]),
    );
    expect(plain(tree)).toEqual({ "a.b": "x", c: { d: "y" } });
  });

  it("throws when a leaf is set where a nested object already exists (reverse collision)", () => {
    const entries = new Map([
      ["a.b", entry("a.b", "Y")],
      ["a", entry("a", "X")],
    ]);
    expect(() => unflattenEntries(entries)).toThrow(AdapterError);
  });
});
