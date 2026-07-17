import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import type { JsonLeaf, JsonRecord } from "../json/json-tree.js";
import { assertNotMixed, buildNgxWriteTree } from "./structure.js";

/** Build an ordered tree from a plain literal; safe here because no literal below has integer-like keys. */
function toTree(node: Record<string, unknown>): JsonRecord {
  return new Map(
    Object.entries(node).map(([key, value]) => [
      key,
      typeof value === "object" && value !== null
        ? toTree(value as Record<string, unknown>)
        : (value as JsonLeaf),
    ]),
  );
}

describe("assertNotMixed", () => {
  it("accepts a purely flat tree", () => {
    expect(() => assertNotMixed(toTree({ "app.hello": "hi", "app.title": "x" }))).not.toThrow();
  });

  it("accepts a purely nested tree", () => {
    expect(() => assertNotMixed(toTree({ app: { hello: "hi", title: "x" } }))).not.toThrow();
  });

  it("accepts a dotless flat tree (flat == nested output)", () => {
    expect(() => assertNotMixed(toTree({ hello: "hi" }))).not.toThrow();
  });

  it("accepts a nested tree with a dotted leaf key (not top-level mixed)", () => {
    expect(() => assertNotMixed(toTree({ app: { "sub.title": "x" } }))).not.toThrow();
  });

  it("rejects a top-level mix of flat dotted key and nested object", () => {
    const error = (() => {
      try {
        assertNotMixed(toTree({ "app.hello": "hi", nav: { home: "Home" } }));
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MIXED_STRUCTURE");
  });

  it("does not flag a dotted string leaf sibling to a nested key as mixed at depth (facet a stays with the collision guard)", () => {
    const tree = toTree({ x: { "a.b": "FLAT-VALUE", a: { b: "NESTED-VALUE" } } });
    expect(() => assertNotMixed(tree)).not.toThrow();
  });

  it("rejects a nested object key that itself contains a literal dot", () => {
    const error = (() => {
      try {
        assertNotMixed(toTree({ "a.b": { c: "Hi" } }));
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MIXED_STRUCTURE");
  });

  it("rejects a dotted object key sibling to a distinct top-level key, at any depth", () => {
    const error = (() => {
      try {
        assertNotMixed(toTree({ "a.b": { c: "X" }, a: { d: "Y" } }));
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MIXED_STRUCTURE");
  });

  it("treats a null leaf as a leaf, not a nested node, so it does not trip the mixed-structure guard", () => {
    expect(() => assertNotMixed(toTree({ "app.hello": "hi", active: null }))).not.toThrow();
  });

  it("treats a null leaf nested under a namespace as a leaf, not a further nesting level", () => {
    expect(() => assertNotMixed(toTree({ ns: { "a.b": "hi", active: null } }))).not.toThrow();
  });

  it("rejects a dotted object key nested under an unrelated namespace", () => {
    const error = (() => {
      try {
        assertNotMixed(toTree({ ns: { "a.b": { c: "Hi" } } }));
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MIXED_STRUCTURE");
  });
});

describe("buildNgxWriteTree", () => {
  function entry(key: string, value: string): TranslationEntry {
    return { key, namespace: "n", value, placeholders: [], isPlural: false };
  }

  /** Collapse the ordered tree to plain data for order-insensitive shape assertions. */
  function plain(value: unknown): unknown {
    if (value instanceof Map) {
      return Object.fromEntries([...value].map(([key, child]) => [key, plain(child)]));
    }
    return value;
  }

  it("defaults to nested for a non-regular destination without reading it", async () => {
    const dirPath = await mkdtemp(join(tmpdir(), "verbatra-ngx-st-"));
    const tree = await buildNgxWriteTree(new Map([["a.b", entry("a.b", "v")]]), dirPath);
    expect(plain(tree)).toEqual({ a: { b: "v" } });
  });
});
