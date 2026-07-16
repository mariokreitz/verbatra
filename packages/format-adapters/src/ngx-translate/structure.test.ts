import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { assertNotMixed, buildNgxWriteTree } from "./structure.js";

describe("assertNotMixed", () => {
  it("accepts a purely flat tree", () => {
    expect(() => assertNotMixed({ "app.hello": "hi", "app.title": "x" })).not.toThrow();
  });

  it("accepts a purely nested tree", () => {
    expect(() => assertNotMixed({ app: { hello: "hi", title: "x" } })).not.toThrow();
  });

  it("accepts a dotless flat tree (flat == nested output)", () => {
    expect(() => assertNotMixed({ hello: "hi" })).not.toThrow();
  });

  it("accepts a nested tree with a dotted leaf key (not top-level mixed)", () => {
    expect(() => assertNotMixed({ app: { "sub.title": "x" } })).not.toThrow();
  });

  it("rejects a top-level mix of flat dotted key and nested object", () => {
    const error = (() => {
      try {
        assertNotMixed({ "app.hello": "hi", nav: { home: "Home" } });
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MIXED_STRUCTURE");
  });

  it("does not flag a dotted string leaf sibling to a nested key as mixed at depth (facet a stays with the collision guard)", () => {
    const tree = { x: { "a.b": "FLAT-VALUE", a: { b: "NESTED-VALUE" } } };
    expect(() => assertNotMixed(tree)).not.toThrow();
  });

  it("rejects a nested object key that itself contains a literal dot", () => {
    const error = (() => {
      try {
        assertNotMixed({ "a.b": { c: "Hi" } });
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
        assertNotMixed({ "a.b": { c: "X" }, a: { d: "Y" } });
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MIXED_STRUCTURE");
  });

  it("treats a null leaf as a leaf, not a nested node, so it does not trip the mixed-structure guard", () => {
    expect(() => assertNotMixed({ "app.hello": "hi", active: null })).not.toThrow();
  });

  it("treats a null leaf nested under a namespace as a leaf, not a further nesting level", () => {
    expect(() => assertNotMixed({ ns: { "a.b": "hi", active: null } })).not.toThrow();
  });

  it("rejects a dotted object key nested under an unrelated namespace", () => {
    const error = (() => {
      try {
        assertNotMixed({ ns: { "a.b": { c: "Hi" } } });
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

  it("defaults to nested for a non-regular destination without reading it", async () => {
    const dirPath = await mkdtemp(join(tmpdir(), "verbatra-ngx-st-"));
    const tree = await buildNgxWriteTree(new Map([["a.b", entry("a.b", "v")]]), dirPath);
    expect(JSON.parse(JSON.stringify(tree))).toEqual({ a: { b: "v" } });
  });
});
