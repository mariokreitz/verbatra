import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { createI18nextJsonAdapter } from "./i18next-adapter.js";

const adapter = createI18nextJsonAdapter();
const dirs: string[] = [];

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "verbatra-fa-"));
  dirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

afterAll(() => {
  // temp dirs live under the OS temp root; left for the OS to reclaim
  dirs.length = 0;
});

describe("i18next JSON adapter: canHandle", () => {
  it("accepts .json paths", () => {
    expect(adapter.canHandle("locales/en/common.json")).toBe(true);
  });

  it("declines non-json paths", () => {
    expect(adapter.canHandle("messages.yaml")).toBe(false);
    expect(adapter.canHandle("data.xlf")).toBe(false);
  });

  it("declines a .json path whose sample is not an object", () => {
    expect(adapter.canHandle("x.json", "[1, 2, 3]")).toBe(false);
    expect(adapter.canHandle("x.json", "{")).toBe(true);
  });
});

describe("i18next JSON adapter: read", () => {
  it("reads nested, namespaced JSON into dotted TranslationEntry records", async () => {
    const path = await tempFile("common.json", '{"auth":{"login":{"submit":"Sign in {{name}}"}}}');
    const { resource } = await adapter.read(path, "en");
    expect(resource.locale).toBe("en");
    expect(resource.namespace).toBe("common");
    expect(resource.format).toBe("i18next-json");
    const entry = resource.entries.get("auth.login.submit");
    expect(entry).toBeDefined();
    expect(entry?.namespace).toBe("common");
    expect(entry?.value).toBe("Sign in {{name}}");
    expect(entry?.placeholders).toEqual(["{{name}}"]);
    expect(entry?.isPlural).toBe(false);
  });

  it("sets isPlural for CLDR plural keys and not for others", async () => {
    const path = await tempFile(
      "p.json",
      '{"items_one":"{{count}} item","items_other":"{{count}} items","label":"x"}',
    );
    const { resource } = await adapter.read(path, "en");
    expect(resource.entries.get("items_one")?.isPlural).toBe(true);
    expect(resource.entries.get("items_other")?.isPlural).toBe(true);
    expect(resource.entries.get("label")?.isPlural).toBe(false);
  });

  it("returns an empty invalidIcuKeys set (i18next is not ICU)", async () => {
    const path = await tempFile("c.json", '{"a":"b"}');
    const { invalidIcuKeys } = await adapter.read(path, "en");
    expect(invalidIcuKeys).toEqual([]);
  });

  it("rejects malformed JSON with a structured error that does not echo content", async () => {
    const secret = "SECRET-CONTENT-1234";
    const path = await tempFile("bad.json", `{ ${secret} not json`);
    await expect(adapter.read(path, "en")).rejects.toMatchObject({
      name: "AdapterError",
      code: "INVALID_JSON",
    });
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).message).not.toContain(secret);
  });

  it("rejects a non-object root with INVALID_STRUCTURE", async () => {
    const path = await tempFile("arr.json", '["not", "an", "object"]');
    await expect(adapter.read(path, "en")).rejects.toMatchObject({ code: "INVALID_STRUCTURE" });
  });

  it("neutralizes prototype-pollution attempts via hostile keys", async () => {
    const path = await tempFile("evil.json", '{"__proto__":{"polluted":"yes"},"a":"b"}');
    const { resource } = await adapter.read(path, "en");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("polluted");
    expect(resource.entries.get("a")?.value).toBe("b");
  });
});

describe("i18next JSON adapter: round-trip", () => {
  const original = [
    "{",
    '  "a": {',
    '    "b": "Hello {{name}}"',
    "  },",
    '  "items_one": "{{count}} item",',
    '  "items_other": "{{count}} items",',
    '  "greeting_male": "Hi sir",',
    '  "ref": "See $t(a.b)"',
    "}",
    "",
  ].join("\n");

  it("read-then-write preserves key order, structure and values", async () => {
    const inPath = await tempFile("common.json", original);
    const { resource } = await adapter.read(inPath, "en");
    const outPath = await tempFile("out.json", "");
    await adapter.write(resource, outPath);
    const written = await readFile(outPath, "utf8");
    expect(written).toBe(original);
  });

  it("write produces JSON the adapter can read back", async () => {
    const inPath = await tempFile("common.json", original);
    const { resource } = await adapter.read(inPath, "en");
    const outPath = await tempFile("out.json", "");
    await adapter.write(resource, outPath);
    const reread = await adapter.read(outPath, "de");
    expect([...reread.resource.entries.keys()]).toEqual([...resource.entries.keys()]);
    expect(reread.resource.entries.get("ref")?.value).toBe("See $t(a.b)");
  });
});

describe("i18next JSON adapter: extractPlaceholders", () => {
  it("is exposed on the interface", () => {
    expect(adapter.extractPlaceholders("{{x}} {{y}}")).toEqual(["{{x}}", "{{y}}"]);
  });
});
