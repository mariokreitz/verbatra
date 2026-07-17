import { describe, expect, it } from "vitest";
import type { AdapterError } from "../errors.js";
import { MAX_DEPTH } from "./limits.js";
import {
  assertWithinDepth,
  type OrderedRecord,
  parseOrderedJson,
  serializeOrderedJson,
} from "./ordered-json.js";

function caught(run: () => unknown): AdapterError {
  try {
    run();
  } catch (error) {
    return error as AdapterError;
  }
  return expect.unreachable("expected a throw") as never;
}

describe("parseOrderedJson key order", () => {
  it("preserves document order for integer-like keys the native parse would hoist", () => {
    const parsed = parseOrderedJson(
      '{"b":"B","10":"ten","2":"two","a":"A","404":"nf","200":"ok"}',
    ) as OrderedRecord;
    expect([...parsed.keys()]).toEqual(["b", "10", "2", "a", "404", "200"]);
  });

  it("preserves order at every nesting level, including inside arrays", () => {
    const parsed = parseOrderedJson('{"outer":{"3":"c","1":"a"},"list":[{"9":"x","0":"y"}]}');
    const root = parsed as OrderedRecord;
    expect([...(root.get("outer") as OrderedRecord).keys()]).toEqual(["3", "1"]);
    const list = root.get("list") as readonly OrderedRecord[];
    expect([...(list[0] as OrderedRecord).keys()]).toEqual(["9", "0"]);
  });

  it("keeps a duplicate key at its first position with its last value", () => {
    const parsed = parseOrderedJson('{"b":"B","a":1,"c":"C","a":2}') as OrderedRecord;
    expect([...parsed.keys()]).toEqual(["b", "a", "c"]);
    expect(parsed.get("a")).toBe(2);
  });
});

describe("parseOrderedJson lexer", () => {
  it("does not mistake a value string for a key, even when the value contains colons and quotes", () => {
    const parsed = parseOrderedJson('{"a": "x:y", "b": "he said \\"hi\\": ok"}') as OrderedRecord;
    expect(parsed.get("a")).toBe("x:y");
    expect(parsed.get("b")).toBe('he said "hi": ok');
  });

  it("handles escaped quotes and backslashes inside a key", () => {
    const parsed = parseOrderedJson('{"say \\"hi\\"": 1, "back\\\\slash": 2}') as OrderedRecord;
    expect([...parsed.keys()]).toEqual(['say "hi"', "back\\slash"]);
  });

  it("recognizes a key separated from its colon by whitespace and newlines", () => {
    const parsed = parseOrderedJson('{"k" \t\r\n : "v"}') as OrderedRecord;
    expect(parsed.get("k")).toBe("v");
  });

  it("accepts a value string containing the sentinel escape text", () => {
    const parsed = parseOrderedJson('{"a": "literal \\u0001 text"}') as OrderedRecord;
    expect(parsed.get("a")).toBe(`literal ${String.fromCharCode(1)} text`);
  });

  it("rejects a key containing the sentinel escape with INVALID_STRUCTURE", () => {
    const error = caught(() => parseOrderedJson('{"bad\\u0001key": "v"}'));
    expect(error.code).toBe("INVALID_STRUCTURE");
  });

  it("rejects a key containing the literal backslash-u-0001 text (documented false positive)", () => {
    const error = caught(() => parseOrderedJson('{"bad\\\\u0001key": "v"}'));
    expect(error.code).toBe("INVALID_STRUCTURE");
  });

  it("reports an unterminated string as INVALID_JSON", () => {
    const error = caught(() => parseOrderedJson('{"a": "unterminated'));
    expect(error.code).toBe("INVALID_JSON");
  });

  it("reports malformed syntax as INVALID_JSON", () => {
    const error = caught(() => parseOrderedJson("{not json"));
    expect(error.code).toBe("INVALID_JSON");
  });

  it("reports a raw unescaped control character in a key as INVALID_JSON", () => {
    const error = caught(() => parseOrderedJson(`{"a${String.fromCharCode(1)}b": "v"}`));
    expect(error.code).toBe("INVALID_JSON");
  });
});

describe("parseOrderedJson roots and leaves", () => {
  it("passes scalar roots through unchanged", () => {
    expect(parseOrderedJson("42")).toBe(42);
    expect(parseOrderedJson('"str"')).toBe("str");
    expect(parseOrderedJson("true")).toBe(true);
    expect(parseOrderedJson("null")).toBeNull();
  });

  it("parses an array root with ordered object items", () => {
    const parsed = parseOrderedJson('[{"2":"b","1":"a"}, 5]') as readonly unknown[];
    expect([...(parsed[0] as OrderedRecord).keys()]).toEqual(["2", "1"]);
    expect(parsed[1]).toBe(5);
  });

  it("rejects nesting beyond the depth cap with MAX_DEPTH_EXCEEDED", () => {
    const deep = `${'{"k":'.repeat(MAX_DEPTH + 1)}"v"${"}".repeat(MAX_DEPTH + 1)}`;
    const error = caught(() => parseOrderedJson(deep));
    expect(error.code).toBe("MAX_DEPTH_EXCEEDED");
  });
});

describe("assertWithinDepth", () => {
  it("accepts nesting at the cap and rejects one level past it, across Maps, arrays, and objects", () => {
    const atCap = new Map([["k", [{ leaf: "v" }]]]);
    expect(() => assertWithinDepth(atCap, 3)).not.toThrow();
    const error = caught(() => assertWithinDepth(new Map([["k", [{ deep: { leaf: "v" } }]]]), 3));
    expect(error.code).toBe("MAX_DEPTH_EXCEEDED");
  });
});

describe("serializeOrderedJson", () => {
  it("emits Maps in iteration order with the pretty-printed two-space layout", () => {
    const tree: OrderedRecord = new Map<string, OrderedRecord | string>([
      ["b", "B"],
      ["10", "ten"],
      [
        "nested",
        new Map<string, OrderedRecord | string>([
          ["2", "two"],
          ["a", "A"],
        ]),
      ],
    ]);
    expect(serializeOrderedJson(tree)).toBe(
      '{\n  "b": "B",\n  "10": "ten",\n  "nested": {\n    "2": "two",\n    "a": "A"\n  }\n}\n',
    );
  });

  it("is byte-identical to JSON.stringify with two-space indent for arrays, scalars, and empties", () => {
    const value = {
      empty: {},
      list: [1, "two", null, true, [], { inner: "x" }],
      flag: false,
    };
    const parsed = parseOrderedJson(JSON.stringify(value));
    expect(serializeOrderedJson(parsed)).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it("round-trips a parsed document byte-for-byte when it was canonically formatted", () => {
    const canonical = '{\n  "zebra": "Z",\n  "7": [\n    "a",\n    "b"\n  ],\n  "alpha": "A"\n}\n';
    expect(serializeOrderedJson(parseOrderedJson(canonical))).toBe(canonical);
  });
});
