import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { type DeriveEntry, flattenTree } from "./flatten.js";
import type { JsonRecord } from "./json-tree.js";

const derive: DeriveEntry = () => ({ placeholders: [], isPlural: false });

describe("flattenTree literal-leaf mode (default)", () => {
  it("encodes a literal dotted leaf so its map key is distinct from a nested path", () => {
    const tree: JsonRecord = { "foo.bar": "Hi" };
    const entries = flattenTree(tree, "ns", derive);
    expect([...entries.keys()]).toEqual(["foo\\.bar"]);
    expect(entries.get("foo\\.bar")?.value).toBe("Hi");
  });

  it("leaves a dotted-free nested path with plain-dot map keys (no churn)", () => {
    const tree: JsonRecord = { a: { b: "B", c: "C" }, d: "D" };
    const entries = flattenTree(tree, "ns", derive);
    expect([...entries.keys()]).toEqual(["a.b", "a.c", "d"]);
  });

  it("preserves document order, including a literal leaf among siblings", () => {
    const tree: JsonRecord = { "a.b": "x", c: { d: "y" }, "e.f.g": "z" };
    const entries = flattenTree(tree, "ns", derive);
    expect([...entries.keys()]).toEqual(["a\\.b", "c.d", "e\\.f\\.g"]);
  });

  it("throws INVALID_STRUCTURE on a literal-leaf vs nested-path collision", () => {
    const tree: JsonRecord = { "foo.bar": "Hi", foo: { bar: "Hello" } };
    const error = (() => {
      try {
        flattenTree(tree, "ns", derive);
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("throws INVALID_STRUCTURE on the same collision in nested-first order", () => {
    const tree: JsonRecord = { foo: { bar: "Hello" }, "foo.bar": "Hi" };
    const error = (() => {
      try {
        flattenTree(tree, "ns", derive);
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("does not flag an unrelated literal leaf and nested path as a collision", () => {
    const tree: JsonRecord = { "a.b": "x", c: { d: "y" } };
    expect(() => flattenTree(tree, "ns", derive)).not.toThrow();
  });
});

describe("flattenTree path-notation mode (ngx-translate)", () => {
  it("does not encode a dotted key; it stays a plain-dot map key", () => {
    const tree: JsonRecord = { "app.hello": "Hi" };
    const entries = flattenTree(tree, "ns", derive, "path-notation");
    expect([...entries.keys()]).toEqual(["app.hello"]);
  });

  it("flattens a nested path to the same plain-dot key as the legacy behavior", () => {
    const tree: JsonRecord = { app: { hello: "Hi" } };
    const entries = flattenTree(tree, "ns", derive, "path-notation");
    expect([...entries.keys()]).toEqual(["app.hello"]);
  });
});
