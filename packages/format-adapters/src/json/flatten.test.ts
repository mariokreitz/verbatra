import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { type DeriveEntry, flattenTree } from "./flatten.js";
import type { JsonRecord } from "./json-tree.js";

const derive: DeriveEntry = () => ({ placeholders: [], isPlural: false });

describe("flattenTree literal-leaf mode (default)", () => {
  it("encodes a literal dotted leaf so its map key is distinct from a nested path", () => {
    const tree: JsonRecord = { "foo.bar": "Hi" };
    const { entries } = flattenTree(tree, "ns", derive);
    expect([...entries.keys()]).toEqual(["foo\\.bar"]);
    expect(entries.get("foo\\.bar")?.value).toBe("Hi");
  });

  it("leaves a dotted-free nested path with plain-dot map keys (no churn)", () => {
    const tree: JsonRecord = { a: { b: "B", c: "C" }, d: "D" };
    const { entries } = flattenTree(tree, "ns", derive);
    expect([...entries.keys()]).toEqual(["a.b", "a.c", "d"]);
  });

  it("preserves document order, including a literal leaf among siblings", () => {
    const tree: JsonRecord = { "a.b": "x", c: { d: "y" }, "e.f.g": "z" };
    const { entries } = flattenTree(tree, "ns", derive);
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
    const { entries } = flattenTree(tree, "ns", derive, "path-notation");
    expect([...entries.keys()]).toEqual(["app.hello"]);
  });

  it("flattens a nested path to the same plain-dot key as the legacy behavior", () => {
    const tree: JsonRecord = { app: { hello: "Hi" } };
    const { entries } = flattenTree(tree, "ns", derive, "path-notation");
    expect([...entries.keys()]).toEqual(["app.hello"]);
  });

  it("throws INVALID_STRUCTURE instead of silently dropping a value on a dotted-leaf vs nested-path collision", () => {
    const tree: JsonRecord = {
      x: { "a.b": "FLAT-VALUE", a: { b: "NESTED-VALUE" } },
    };
    const error = (() => {
      try {
        flattenTree(tree, "ns", derive, "path-notation");
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("throws INVALID_STRUCTURE on the same collision in nested-first order", () => {
    const tree: JsonRecord = {
      x: { a: { b: "NESTED-VALUE" }, "a.b": "FLAT-VALUE" },
    };
    const error = (() => {
      try {
        flattenTree(tree, "ns", derive, "path-notation");
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("does not flag unrelated dotted and nested keys as a collision", () => {
    const tree: JsonRecord = { "a.b": "x", c: { d: "y" } };
    expect(() => flattenTree(tree, "ns", derive, "path-notation")).not.toThrow();
  });

  it("throws INVALID_STRUCTURE when a dotted leaf's path is a strict ancestor of a deeper nested leaf", () => {
    const tree: JsonRecord = { x: { "a.b": "FLAT-VALUE", a: { b: { c: "NESTED-VALUE" } } } };
    const error = (() => {
      try {
        flattenTree(tree, "ns", derive, "path-notation");
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("throws INVALID_STRUCTURE on the same ancestor collision in nested-first order", () => {
    const tree: JsonRecord = { x: { a: { b: { c: "NESTED-VALUE" } }, "a.b": "FLAT-VALUE" } };
    const error = (() => {
      try {
        flattenTree(tree, "ns", derive, "path-notation");
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("does not flag a dotted leaf and an unrelated deeper nested path sharing only a common ancestor", () => {
    const tree: JsonRecord = { x: { "a.b": "FLAT-VALUE", c: { d: { e: "NESTED-VALUE" } } } };
    expect(() => flattenTree(tree, "ns", derive, "path-notation")).not.toThrow();
  });
});

describe("flattenTree non-string leaf exclusion (literal-leaf mode)", () => {
  it("excludes number, boolean, and null leaves from entries and reports their paths", () => {
    const tree: JsonRecord = { greeting: "Hi", count: 5, enabled: true, active: null };
    const { entries, excludedLeafPaths } = flattenTree(tree, "ns", derive);
    expect([...entries.keys()]).toEqual(["greeting"]);
    expect(excludedLeafPaths).toEqual(["count", "enabled", "active"]);
  });

  it("never calls derive for a non-string leaf", () => {
    const calls: string[] = [];
    const tracking: DeriveEntry = (key, value) => {
      calls.push(key);
      return { placeholders: [], isPlural: value.length > 0 };
    };
    const tree: JsonRecord = { greeting: "Hi", count: 5 };
    flattenTree(tree, "ns", tracking);
    expect(calls).toEqual(["greeting"]);
  });

  it("reports a nested non-string leaf's path with the literal-leaf encoding", () => {
    const tree: JsonRecord = { a: { "b.c": 5 } };
    const { excludedLeafPaths } = flattenTree(tree, "ns", derive);
    expect(excludedLeafPaths).toEqual(["a.b\\.c"]);
  });

  it("still claims a non-string leaf's path, throwing on a literal-vs-nested collision", () => {
    const tree: JsonRecord = { "foo.bar": 5, foo: { bar: "Hello" } };
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
});

describe("flattenTree non-string leaf exclusion (path-notation mode)", () => {
  it("excludes non-string leaves from entries and reports their plain-dot paths", () => {
    const tree: JsonRecord = { "app.hello": "Hi", "app.count": 5 };
    const { entries, excludedLeafPaths } = flattenTree(tree, "ns", derive, "path-notation");
    expect([...entries.keys()]).toEqual(["app.hello"]);
    expect(excludedLeafPaths).toEqual(["app.count"]);
  });

  it("never calls derive for a non-string leaf", () => {
    const calls: string[] = [];
    const tracking: DeriveEntry = (key, value) => {
      calls.push(key);
      return { placeholders: [], isPlural: value.length > 0 };
    };
    const tree: JsonRecord = { hello: "Hi", count: 5 };
    flattenTree(tree, "ns", tracking, "path-notation");
    expect(calls).toEqual(["hello"]);
  });

  it("still claims a non-string leaf's path, throwing on a dotted-leaf vs nested-path collision", () => {
    const tree: JsonRecord = { x: { "a.b": 5, a: { b: "NESTED-VALUE" } } };
    const error = (() => {
      try {
        flattenTree(tree, "ns", derive, "path-notation");
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });
});
