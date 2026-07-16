import { describe, expect, it } from "vitest";
import type { AdapterError } from "../errors.js";
import { assertJsonRecord, isJsonNode, parseJsonObject, serializeJsonTree } from "./json-tree.js";
import { MAX_DEPTH } from "./limits.js";

function caught(run: () => unknown): AdapterError {
  try {
    run();
  } catch (error) {
    return error as AdapterError;
  }
  return expect.unreachable("expected a throw") as never;
}

describe("assertJsonRecord", () => {
  it("accepts a Map tree of scalar leaves and returns it unchanged", () => {
    const tree = new Map<string, unknown>([
      ["s", "text"],
      ["n", 5],
      ["b", true],
      ["z", null],
      ["nested", new Map([["k", "v"]])],
    ]);
    expect(assertJsonRecord(tree)).toBe(tree);
  });

  it("rejects a non-Map root with INVALID_STRUCTURE", () => {
    for (const value of [{ a: "x" }, ["x"], "x", 5, null, undefined]) {
      expect(caught(() => assertJsonRecord(value)).code).toBe("INVALID_STRUCTURE");
    }
  });

  it("rejects an array leaf, at the root and nested, with INVALID_STRUCTURE", () => {
    expect(caught(() => assertJsonRecord(new Map([["a", ["x"]]]))).code).toBe("INVALID_STRUCTURE");
    const nested = new Map([["outer", new Map([["a", ["x"]]])]]);
    expect(caught(() => assertJsonRecord(nested)).code).toBe("INVALID_STRUCTURE");
  });

  it("rejects a non-string key with INVALID_STRUCTURE", () => {
    expect(caught(() => assertJsonRecord(new Map([[1, "x"]]))).code).toBe("INVALID_STRUCTURE");
  });

  it("rejects an undefined leaf with INVALID_STRUCTURE", () => {
    expect(caught(() => assertJsonRecord(new Map([["a", undefined]]))).code).toBe(
      "INVALID_STRUCTURE",
    );
  });

  it("rejects nesting beyond the depth cap with MAX_DEPTH_EXCEEDED", () => {
    let tree: Map<string, unknown> = new Map([["leaf", "v"]]);
    for (let i = 0; i < MAX_DEPTH + 1; i += 1) {
      tree = new Map([["k", tree]]);
    }
    expect(caught(() => assertJsonRecord(tree)).code).toBe("MAX_DEPTH_EXCEEDED");
  });
});

describe("parseJsonObject", () => {
  it("parses into a Map tree that preserves document key order at every level", () => {
    const tree = parseJsonObject('{"b":"B","10":"ten","nested":{"2":"two","a":"A"}}');
    expect([...tree.keys()]).toEqual(["b", "10", "nested"]);
    const nested = tree.get("nested");
    expect(isJsonNode(nested)).toBe(true);
    expect([...(nested as ReadonlyMap<string, unknown>).keys()]).toEqual(["2", "a"]);
  });

  it("throws INVALID_JSON on malformed content", () => {
    expect(caught(() => parseJsonObject("{oops")).code).toBe("INVALID_JSON");
  });

  it("throws INVALID_STRUCTURE on a non-object root", () => {
    expect(caught(() => parseJsonObject("[1,2]")).code).toBe("INVALID_STRUCTURE");
  });
});

describe("serializeJsonTree", () => {
  it("serializes in Map iteration order with a trailing newline", () => {
    const source = '{\n  "10": "ten",\n  "2": "two",\n  "b": "B"\n}\n';
    expect(serializeJsonTree(parseJsonObject(source))).toBe(source);
  });
});

describe("isJsonNode", () => {
  it("is true exactly for Maps, treating every scalar including null as a leaf", () => {
    expect(isJsonNode(new Map())).toBe(true);
    expect(isJsonNode(null)).toBe(false);
    expect(isJsonNode("x")).toBe(false);
    expect(isJsonNode(5)).toBe(false);
    expect(isJsonNode({})).toBe(false);
  });
});
