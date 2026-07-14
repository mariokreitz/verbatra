import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRegistry } from "../default-registry.js";
import { MAX_INPUT_BYTES } from "../json/limits.js";
import { createNgxTranslateJsonAdapter } from "./ngx-translate-adapter.js";

const adapter = createNgxTranslateJsonAdapter();

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "verbatra-ngx-"));
}
async function write(dir: string, name: string, content: string | Uint8Array): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, content);
  return path;
}

const FLAT = ["{", '  "app.hello": "hello {{value}}",', '  "app.title": "Demo"', "}", ""].join(
  "\n",
);
const NESTED = [
  "{",
  '  "app": {',
  '    "hello": "hello {{value}}",',
  '    "title": "Demo"',
  "  }",
  "}",
  "",
].join("\n");

describe("ngx-translate adapter: format and registry", () => {
  it("declares the ngx-translate-json format", () => {
    expect(adapter.format).toBe("ngx-translate-json");
  });

  it("is resolved by explicit format and listed in the ambiguous candidates", () => {
    const registry = createDefaultRegistry();
    const resolved = registry.resolve("en.json", { format: "ngx-translate-json" });
    expect(resolved.status).toBe("resolved");
    const bare = registry.resolve("en.json");
    expect(bare.status).toBe("ambiguous");
    if (bare.status === "ambiguous") {
      expect(bare.candidates).toContain("ngx-translate-json");
    }
  });

  it("accepts .json and declines other extensions", () => {
    expect(adapter.canHandle("en.json")).toBe(true);
    expect(adapter.canHandle("en.yaml")).toBe(false);
  });
});

describe("ngx-translate adapter: read (both structures)", () => {
  it("reads a flat file into dotted keys with {{interpolation}}", async () => {
    const dir = await tempDir();
    const { resource, invalidIcuKeys } = await adapter.read(
      await write(dir, "common.json", FLAT),
      "en",
    );
    expect(resource.namespace).toBe("common");
    const entry = resource.entries.get("app.hello");
    expect(entry?.value).toBe("hello {{value}}");
    expect(entry?.placeholders).toEqual(["{{value}}"]);
    expect(entry?.isPlural).toBe(false);
    expect(invalidIcuKeys).toEqual([]);
  });

  it("reads a nested file into the same dotted keys", async () => {
    const dir = await tempDir();
    const { resource } = await adapter.read(await write(dir, "common.json", NESTED), "en");
    expect([...resource.entries.keys()]).toEqual(["app.hello", "app.title"]);
    expect(resource.entries.get("app.hello")?.placeholders).toEqual(["{{value}}"]);
  });

  it("rejects a mixed flat+nested file with a structured error", async () => {
    const dir = await tempDir();
    const path = await write(dir, "m.json", '{"app.hello":"hi","nav":{"home":"Home"}}');
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe("MIXED_STRUCTURE");
  });

  it("rejects malformed JSON with a structured error", async () => {
    const dir = await tempDir();
    const path = await write(dir, "bad.json", "{ not json");
    await expect(adapter.read(path, "en")).rejects.toMatchObject({ code: "INVALID_JSON" });
  });

  it("rejects a nested mixed dotted/nested collision instead of silently dropping a value", async () => {
    const dir = await tempDir();
    const path = await write(
      dir,
      "collide.json",
      '{"x":{"a.b":"FLAT-VALUE","a":{"b":"NESTED-VALUE"}}}',
    );
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe("INVALID_STRUCTURE");
  });

  it("rejects a nested object key that itself contains a literal dot", async () => {
    const dir = await tempDir();
    const path = await write(dir, "dotted-object.json", '{"a.b":{"c":"Hi"}}');
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe("MIXED_STRUCTURE");
  });

  it("rejects a dotted object key that would otherwise merge distinct top-level keys on write", async () => {
    const dir = await tempDir();
    const path = await write(dir, "merge.json", '{"a.b":{"c":"X"},"a":{"d":"Y"}}');
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe("MIXED_STRUCTURE");
  });

  it("reads a flat file with scalar leaves (including null), excluding them, not the whole file", async () => {
    const dir = await tempDir();
    const path = await write(
      dir,
      "scalars.json",
      '{"app.hello":"Hi","count":5,"enabled":true,"active":null}',
    );
    const { resource, excludedLeafPaths } = await adapter.read(path, "en");
    expect([...resource.entries.keys()]).toEqual(["app.hello"]);
    expect([...excludedLeafPaths].sort()).toEqual(["active", "count", "enabled"]);
  });
});

describe("ngx-translate adapter: structure-preserving round-trip", () => {
  it("keeps a flat file flat (byte-for-byte, written over the same path)", async () => {
    const dir = await tempDir();
    const path = await write(dir, "common.json", FLAT);
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    expect(await readFile(path, "utf8")).toBe(FLAT);
  });

  it("keeps a nested file nested (byte-for-byte, written over the same path)", async () => {
    const dir = await tempDir();
    const path = await write(dir, "common.json", NESTED);
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    expect(await readFile(path, "utf8")).toBe(NESTED);
  });

  it("defaults to nested when writing to a new path", async () => {
    const dir = await tempDir();
    const { resource } = await adapter.read(await write(dir, "common.json", FLAT), "en");
    const newPath = join(dir, "fresh.json");
    await adapter.write(resource, newPath);
    expect(await readFile(newPath, "utf8")).toBe(NESTED);
  });

  it("defaults to nested when the destination is not a JSON object", async () => {
    const dir = await tempDir();
    const { resource } = await adapter.read(await write(dir, "common.json", NESTED), "en");
    const path = await write(dir, "weird.json", "[1, 2, 3]");
    await adapter.write(resource, path);
    expect(await readFile(path, "utf8")).toBe(NESTED);
  });

  it("rejects a non-regular file path (e.g. a directory) with a structured error", async () => {
    const dir = await tempDir();
    const error = await adapter.read(dir, "en").catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe("INVALID_STRUCTURE");
  });

  it("does not read an over-size destination; defaults to nested (bounded write path)", async () => {
    const dir = await tempDir();
    const { resource } = await adapter.read(await write(dir, "common.json", FLAT), "en");
    // a destination larger than the read-path cap must not be loaded to detect style
    const oversized = join(dir, "oversized.json");
    await writeFile(oversized, new Uint8Array(MAX_INPUT_BYTES + 1));
    await adapter.write(resource, oversized);
    expect(await readFile(oversized, "utf8")).toBe(NESTED);
  });
});

describe("ngx-translate adapter: safety", () => {
  it("neutralizes a hostile flat-dotted key without polluting prototypes", async () => {
    const dir = await tempDir();
    const path = await write(dir, "evil.json", '{"__proto__":"evil","a":"b"}');
    const { resource } = await adapter.read(path, "en");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(resource.entries.get("a")?.value).toBe("b");
    await adapter.write(resource, path);
    expect(Object.prototype).not.toHaveProperty("polluted");
    expect(({} as Record<string, unknown>).a).toBeUndefined();
  });

  it("treats values as plain strings: isPlural is always false, no ICU parsed", async () => {
    const dir = await tempDir();
    const path = await write(dir, "c.json", '{"k":"{count, plural, one {x} other {y}}"}');
    const { resource, invalidIcuKeys } = await adapter.read(path, "en");
    expect(resource.entries.get("k")?.isPlural).toBe(false);
    expect(resource.entries.get("k")?.value).toBe("{count, plural, one {x} other {y}}");
    expect(invalidIcuKeys).toEqual([]);
  });
});
