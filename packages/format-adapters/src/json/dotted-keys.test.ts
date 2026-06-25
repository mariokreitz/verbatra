import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { FormatAdapter } from "../adapter.js";
import { AdapterError } from "../errors.js";
import { createI18nextJsonAdapter } from "../i18next/i18next-adapter.js";
import { createNextIntlJsonAdapter } from "../next-intl/next-intl-adapter.js";
import { createNgxTranslateJsonAdapter } from "../ngx-translate/ngx-translate-adapter.js";
import { createVueI18nJsonAdapter } from "../vue-i18n/vue-i18n-adapter.js";

const dirs: string[] = [];

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "verbatra-dotted-"));
  dirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

afterAll(() => {
  dirs.length = 0;
});

/** Read a file with an adapter and write it back, returning the written text. */
async function roundTrip(adapter: FormatAdapter, content: string): Promise<string> {
  const inPath = await tempFile("in.json", content);
  const { resource } = await adapter.read(inPath, "en");
  const outPath = await tempFile("out.json", "");
  await adapter.write(resource, outPath);
  return readFile(outPath, "utf8");
}

const literalLeafAdapters: ReadonlyArray<readonly [string, () => FormatAdapter]> = [
  ["i18next", createI18nextJsonAdapter],
  ["vue-i18n", createVueI18nJsonAdapter],
  ["next-intl", createNextIntlJsonAdapter],
];

describe.each(literalLeafAdapters)("%s adapter: literal dotted leaf round-trip", (_name, make) => {
  const adapter = make();

  it("preserves a single literal dotted leaf as one leaf, not re-nested", async () => {
    const input = '{\n  "foo.bar": "Hi"\n}\n';
    expect(await roundTrip(adapter, input)).toBe(input);
  });

  it("keeps a real nested path nested", async () => {
    const input = '{\n  "foo": {\n    "bar": "Hi"\n  }\n}\n';
    expect(await roundTrip(adapter, input)).toBe(input);
  });

  it("preserves a multi-dot literal leaf key in full", async () => {
    const input = '{\n  "a.b.c": "Hi"\n}\n';
    expect(await roundTrip(adapter, input)).toBe(input);
  });

  it("preserves a mixed file: literal dotted leaf plus an unrelated nested path", async () => {
    const input = '{\n  "a.b": "x",\n  "c": {\n    "d": "y"\n  }\n}\n';
    expect(await roundTrip(adapter, input)).toBe(input);
  });

  it("reads a literal dotted leaf as a single entry whose key carries the dot", async () => {
    const inPath = await tempFile("in.json", '{"foo.bar":"Hi"}');
    const { resource } = await adapter.read(inPath, "en");
    expect([...resource.entries.keys()]).toEqual(["foo\\.bar"]);
    expect(resource.entries.get("foo\\.bar")?.value).toBe("Hi");
  });

  it("throws a structured INVALID_STRUCTURE on a genuine literal-vs-nested collision", async () => {
    const inPath = await tempFile("in.json", '{"foo.bar":"Hi","foo":{"bar":"Hello"}}');
    const error = await adapter.read(inPath, "en").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("throws a structured INVALID_STRUCTURE on the same collision in nested-first order", async () => {
    const inPath = await tempFile("in.json", '{"foo":{"bar":"Hello"},"foo.bar":"Hi"}');
    const error = await adapter.read(inPath, "en").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("round-trips a literal backslash key byte-identically", async () => {
    const input = '{\n  "a\\\\b": "x"\n}\n';
    expect(await roundTrip(adapter, input)).toBe(input);
  });

  it("round-trips a non-ASCII literal dotted leaf key byte-identically", async () => {
    const input = '{\n  "clé.été": "Bonjour"\n}\n';
    expect(await roundTrip(adapter, input)).toBe(input);
  });

  it("is deterministic: a second round-trip yields identical output and ordering", async () => {
    const input = '{\n  "a.b": "x",\n  "c": {\n    "d": "y"\n  },\n  "e.f.g": "z"\n}\n';
    const first = await roundTrip(adapter, input);
    const second = await roundTrip(adapter, first);
    expect(second).toBe(first);
    expect(first).toBe(input);
  });
});

describe("ngx-translate adapter: dotted keys stay path notation (unchanged behavior)", () => {
  const adapter = createNgxTranslateJsonAdapter();

  /** ngx preserves the destination's style, so round-trip in place over existing content. */
  async function roundTripInPlace(content: string): Promise<string> {
    const path = await tempFile("ngx.json", content);
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    return readFile(path, "utf8");
  }

  it("round-trips a flat dotted file unchanged (flat style preserved)", async () => {
    const input = '{\n  "app.hello": "Hi",\n  "app.bye": "Bye"\n}\n';
    expect(await roundTripInPlace(input)).toBe(input);
  });

  it("round-trips a nested file unchanged", async () => {
    const input = '{\n  "app": {\n    "hello": "Hi"\n  }\n}\n';
    expect(await roundTripInPlace(input)).toBe(input);
  });

  it("reads a flat dotted key as a path-notation map key (no escaping)", async () => {
    const inPath = await tempFile("in.json", '{"app.hello":"Hi"}');
    const { resource } = await adapter.read(inPath, "en");
    expect([...resource.entries.keys()]).toEqual(["app.hello"]);
  });
});
