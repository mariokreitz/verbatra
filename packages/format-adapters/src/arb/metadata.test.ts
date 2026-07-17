import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { AdapterError } from "../errors.js";
import { serializeJsonTree } from "../json/json-tree.js";
import {
  buildArbWriteTree,
  extractArbDescriptions,
  parseArbObject,
  stripArbMetadata,
} from "./metadata.js";

function entry(key: string, value: string): TranslationEntry {
  return { key, namespace: "app", value, placeholders: [], isPlural: false };
}

/** Collapse an ordered tree to plain data for order-insensitive shape assertions. */
function plain(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries([...value].map(([key, child]) => [key, plain(child)]));
  }
  return value;
}

async function tempArb(value: unknown): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "verbatra-arbmeta-")), "app.arb");
  await writeFile(path, JSON.stringify(value));
  return path;
}

describe("parseArbObject", () => {
  it("parses a top-level ordered Map, keeping raw metadata values unvalidated", () => {
    const parsed = parseArbObject(
      JSON.stringify({ a: "A", "@a": { placeholders: { count: { decimalDigits: 2 } } } }),
    );
    expect(parsed.get("a")).toBe("A");
    expect(plain(parsed.get("@a"))).toEqual({ placeholders: { count: { decimalDigits: 2 } } });
  });

  it("preserves document order for integer-named keys inside metadata subtrees", () => {
    const parsed = parseArbObject(
      '{"a": "A {0} {1}", "@a": {"placeholders": {"1": {"type": "int"}, "0": {"type": "int"}}}}',
    );
    const metadata = parsed.get("@a") as ReadonlyMap<string, unknown>;
    const placeholders = metadata.get("placeholders") as ReadonlyMap<string, unknown>;
    expect([...placeholders.keys()]).toEqual(["1", "0"]);
  });

  it("throws INVALID_JSON on malformed syntax", () => {
    try {
      parseArbObject("{not json");
      expect.unreachable("expected a throw");
    } catch (error) {
      expect((error as AdapterError).code).toBe("INVALID_JSON");
    }
  });

  it("throws INVALID_STRUCTURE on a non-object root", () => {
    for (const raw of ["[1,2,3]", '"a string"', "null", "42"]) {
      try {
        parseArbObject(raw);
        expect.unreachable("expected a throw");
      } catch (error) {
        expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
      }
    }
  });
});

describe("stripArbMetadata", () => {
  it("drops @ and @@ keys, keeping only message keys", () => {
    const tree = parseArbObject(
      JSON.stringify({ "@@locale": "en", a: "A", "@a": { description: "d" }, b: "B" }),
    );
    expect(plain(stripArbMetadata(tree))).toEqual({ a: "A", b: "B" });
  });

  it("returns a Map, keeping a hostile key as inert data in document order", () => {
    const result = stripArbMetadata(parseArbObject('{"b": "B", "__proto__": "x", "a": "A"}'));
    expect(result).toBeInstanceOf(Map);
    expect([...result.keys()]).toEqual(["b", "__proto__", "a"]);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe("extractArbDescriptions", () => {
  it("maps a message key to its @key.description", () => {
    const descriptions = extractArbDescriptions(
      JSON.stringify({ greeting: "Hi", "@greeting": { description: "A greeting" } }),
    );
    expect(descriptions.get("greeting")).toBe("A greeting");
  });

  it("encodes a literal dotted message key the same way flattenTree's literal-leaf mode does", () => {
    const descriptions = extractArbDescriptions(
      JSON.stringify({
        "page.title": "Welcome",
        "@page.title": { description: "The page title" },
      }),
    );
    expect(descriptions.get("page\\.title")).toBe("The page title");
    expect(descriptions.has("page.title")).toBe(false);
  });

  it("skips global @@-prefixed metadata, never treating it as a per-message description", () => {
    const descriptions = extractArbDescriptions(
      JSON.stringify({ "@@locale": "en", "@@x-context": { description: "not a message" } }),
    );
    expect(descriptions.size).toBe(0);
  });

  it("skips metadata with no description field, or a non-string one", () => {
    const descriptions = extractArbDescriptions(
      JSON.stringify({
        a: "A",
        "@a": { placeholders: {} },
        b: "B",
        "@b": { description: 42 },
      }),
    );
    expect(descriptions.size).toBe(0);
  });

  it("skips metadata whose value is not an object at all", () => {
    const descriptions = extractArbDescriptions(
      JSON.stringify({ a: "A", "@a": "not an object", b: "B", "@b": null }),
    );
    expect(descriptions.size).toBe(0);
  });
});

describe("buildArbWriteTree", () => {
  it("merges translations into the destination, preserving metadata and order", async () => {
    const path = await tempArb({ "@@locale": "en", a: "A", "@a": { description: "d" }, b: "B" });
    const entries = new Map([
      ["a", entry("a", "AA")],
      ["b", entry("b", "BB")],
    ]);
    const tree = await buildArbWriteTree(entries, path);
    expect([...tree.keys()]).toEqual(["@@locale", "a", "@a", "b"]);
    expect(tree.get("a")).toBe("AA");
    expect(tree.get("b")).toBe("BB");
    expect(plain(tree.get("@a"))).toEqual({ description: "d" });
  });

  it("retains document order for a metadata placeholders block with integer-named keys", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "verbatra-arbmeta-")), "app.arb");
    await writeFile(
      path,
      '{"count": "{1} of {0}", "@count": {"placeholders": {"1": {"type": "int"}, "0": {"type": "int"}}}}',
    );
    const tree = await buildArbWriteTree(new Map([["count", entry("count", "{1} von {0}")]]), path);
    const serialized = serializeJsonTree(tree);
    expect(serialized.indexOf('"1"')).toBeLessThan(serialized.indexOf('"0"'));
    const metadata = tree.get("@count") as ReadonlyMap<string, unknown>;
    const placeholders = metadata.get("placeholders") as ReadonlyMap<string, unknown>;
    expect([...placeholders.keys()]).toEqual(["1", "0"]);
  });

  it("keeps a destination message that was not translated", async () => {
    const path = await tempArb({ a: "A", b: "B" });
    const tree = await buildArbWriteTree(new Map([["a", entry("a", "AA")]]), path);
    expect(plain(tree)).toMatchObject({ a: "AA", b: "B" });
  });

  it("drops a stray non-string, non-metadata destination leaf instead of carrying it over", async () => {
    const path = await tempArb({ a: "A", revision: 3 });
    const tree = await buildArbWriteTree(new Map([["a", entry("a", "AA")]]), path);
    expect(plain(tree)).toEqual({ a: "AA" });
  });

  it("appends new message keys not present in the destination, in entry order", async () => {
    const path = await tempArb({ a: "A" });
    const entries = new Map([
      ["a", entry("a", "AA")],
      ["c", entry("c", "CC")],
    ]);
    const tree = await buildArbWriteTree(entries, path);
    expect([...tree.keys()]).toEqual(["a", "c"]);
  });

  it("emits messages only when the destination is missing", async () => {
    const missing = join(await mkdtemp(join(tmpdir(), "verbatra-arbmeta-")), "absent.arb");
    const tree = await buildArbWriteTree(new Map([["a", entry("a", "A")]]), missing);
    expect(plain(tree)).toEqual({ a: "A" });
  });

  it("throws INVALID_STRUCTURE instead of silently discarding a destination that is not a JSON object", async () => {
    const path = await tempArb(["not", "an", "object"]);
    try {
      await buildArbWriteTree(new Map([["a", entry("a", "A")]]), path);
      expect.unreachable("expected a throw");
    } catch (error) {
      expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
    }
  });

  it("throws INVALID_JSON instead of silently erasing metadata when the destination is corrupt", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "verbatra-arbmeta-")), "app.arb");
    await writeFile(path, '{"@@locale": "en", "a": "A", not valid json');
    try {
      await buildArbWriteTree(new Map([["a", entry("a", "AA")]]), path);
      expect.unreachable("expected a throw");
    } catch (error) {
      expect((error as AdapterError).code).toBe("INVALID_JSON");
    }
  });

  it("throws INVALID_STRUCTURE instead of silently proceeding when the destination path is a directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "verbatra-arbmeta-"));
    try {
      await buildArbWriteTree(new Map([["a", entry("a", "A")]]), dir);
      expect.unreachable("expected a throw");
    } catch (error) {
      expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
    }
  });
});
