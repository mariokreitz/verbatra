import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRegistry } from "../default-registry.js";
import type { AdapterError } from "../errors.js";
import { MAX_DEPTH, MAX_INPUT_BYTES } from "../json/limits.js";
import { createVueI18nJsonAdapter } from "./vue-i18n-adapter.js";

const adapter = createVueI18nJsonAdapter();

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "verbatra-vue-"));
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

describe("vue-i18n adapter: format and registry", () => {
  it("declares the vue-i18n-json format", () => {
    expect(adapter.format).toBe("vue-i18n-json");
  });

  it("is resolved from the default registry by explicit format", () => {
    const result = createDefaultRegistry().resolve("en.json", { format: "vue-i18n-json" });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.adapter.format).toBe("vue-i18n-json");
    }
  });

  it("makes a bare .json ambiguous across the registered JSON adapters", () => {
    const result = createDefaultRegistry().resolve("en.json");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toContain("vue-i18n-json");
    }
  });

  it("accepts .json and declines other extensions", () => {
    expect(adapter.canHandle("locales/en.json")).toBe(true);
    expect(adapter.canHandle("messages.yaml")).toBe(false);
  });
});

describe("vue-i18n adapter: read", () => {
  it("reads nested JSON into dotted keys with single-brace placeholders", async () => {
    const path = await tempFile("common.json", '{"nav":{"greeting":"hello {name}"}}');
    const { resource } = await adapter.read(path, "en");
    expect(resource.namespace).toBe("common");
    const entry = resource.entries.get("nav.greeting");
    expect(entry?.value).toBe("hello {name}");
    expect(entry?.placeholders).toEqual(["{name}"]);
    expect(entry?.isPlural).toBe(false);
  });

  it("recognizes a pipe-plural value, keeps it verbatim, and extracts across forms", async () => {
    const path = await tempFile("c.json", '{"apples":"no apples | one apple | {count} apples"}');
    const { resource } = await adapter.read(path, "en");
    const entry = resource.entries.get("apples");
    expect(entry?.isPlural).toBe(true);
    expect(entry?.value).toBe("no apples | one apple | {count} apples");
    expect(entry?.placeholders).toEqual(["{count}"]);
    expect(resource.entries.size).toBe(1);
  });

  it("preserves linked messages in the value without extracting them", async () => {
    const path = await tempFile("c.json", '{"ref":"see @:nav.home"}');
    const { resource } = await adapter.read(path, "en");
    const entry = resource.entries.get("ref");
    expect(entry?.value).toBe("see @:nav.home");
    expect(entry?.placeholders).toEqual([]);
    expect(entry?.isPlural).toBe(false);
  });

  it("returns an empty invalidIcuKeys set (vue-i18n is not ICU)", async () => {
    const path = await tempFile("c.json", '{"a":"b | c"}');
    const { invalidIcuKeys } = await adapter.read(path, "en");
    expect(invalidIcuKeys).toEqual([]);
  });

  it("rejects malformed JSON with a structured error", async () => {
    const path = await tempFile("bad.json", "{ not json");
    await expect(adapter.read(path, "en")).rejects.toMatchObject({
      name: "AdapterError",
      code: "INVALID_JSON",
    });
  });

  it("neutralizes prototype-pollution attempts via hostile keys", async () => {
    const path = await tempFile("evil.json", '{"__proto__":{"polluted":"yes"},"a":"b"}');
    const { resource } = await adapter.read(path, "en");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(resource.entries.get("a")?.value).toBe("b");
  });
});

describe("vue-i18n adapter: round-trip", () => {
  const original = [
    "{",
    '  "greeting": "hello {name}",',
    '  "apples": "no apples | one apple | {count} apples",',
    '  "nav": {',
    '    "home": "Home",',
    '    "ref": "see @:nav.home"',
    "  }",
    "}",
    "",
  ].join("\n");

  it("round-trips a placeholder, a pipe-plural value, and a linked message byte-for-byte", async () => {
    const inPath = await tempFile("common.json", original);
    const { resource } = await adapter.read(inPath, "en");
    const outPath = await tempFile("out.json", "");
    await adapter.write(resource, outPath);
    expect(await readFile(outPath, "utf8")).toBe(original);
  });

  it("is deterministic across reads and writes", async () => {
    const inPath = await tempFile("common.json", original);
    const r1 = await adapter.read(inPath, "en");
    const r2 = await adapter.read(inPath, "en");
    expect([...r1.resource.entries]).toEqual([...r2.resource.entries]);
    const o1 = await tempFile("o1.json", "");
    const o2 = await tempFile("o2.json", "");
    await adapter.write(r1.resource, o1);
    await adapter.write(r2.resource, o2);
    expect(await readFile(o1, "utf8")).toBe(await readFile(o2, "utf8"));
  });
});

describe("vue-i18n adapter: carryover bounds", () => {
  it("rejects over-deep nesting with a structured error, not a RangeError", async () => {
    const depth = MAX_DEPTH + 25;
    const content = `${'{"a":'.repeat(depth)}"x"${"}".repeat(depth)}`;
    const path = await tempFile("deep.json", content);
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect((error as AdapterError).code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("rejects oversized input with INPUT_TOO_LARGE", async () => {
    const dir = await mkdtemp(join(tmpdir(), "verbatra-vue-"));
    const path = join(dir, "big.json");
    await writeFile(path, new Uint8Array(MAX_INPUT_BYTES + 1));
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect((error as AdapterError).code).toBe("INPUT_TOO_LARGE");
  });
});
