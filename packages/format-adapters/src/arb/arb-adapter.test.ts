import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AdapterError } from "../errors.js";
import { createArbAdapter } from "./arb-adapter.js";

const adapter = createArbAdapter();

const SAMPLE = {
  "@@locale": "en",
  greeting: "Hello {name}",
  "@greeting": { description: "A greeting", placeholders: { name: { type: "String" } } },
  items: "{count, plural, one {# item} other {# items}}",
  "@items": { description: "Item count" },
};

async function tempArb(name: string, value: unknown): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "verbatra-arb-")), name);
  await writeFile(path, JSON.stringify(value, null, 2));
  return path;
}

async function readError(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

describe("createArbAdapter detection", () => {
  it("handles .arb with a brace sniff", () => {
    expect(adapter.canHandle("app_en.arb")).toBe(true);
    expect(adapter.canHandle("app_en.arb", "{")).toBe(true);
    expect(adapter.canHandle("app_en.arb", "not json")).toBe(false);
    expect(adapter.canHandle("app_en.json")).toBe(false);
  });

  it("reports format arb", () => {
    expect(adapter.format).toBe("arb");
  });
});

describe("createArbAdapter read", () => {
  it("strips @ and @@ metadata so only messages become entries", async () => {
    const { resource } = await adapter.read(await tempArb("app_en.arb", SAMPLE), "en");
    expect([...resource.entries.keys()]).toEqual(["greeting", "items"]);
    expect(resource.entries.has("@@locale")).toBe(false);
    expect(resource.entries.has("@greeting")).toBe(false);
  });

  it("extracts ICU placeholders and detects plurals", async () => {
    const { resource } = await adapter.read(await tempArb("app_en.arb", SAMPLE), "en");
    expect(resource.entries.get("greeting")?.placeholders).toEqual(["{name}"]);
    expect(resource.entries.get("items")?.isPlural).toBe(true);
  });

  it("records invalid ICU values in invalidIcuKeys without throwing", async () => {
    const { invalidIcuKeys } = await adapter.read(
      await tempArb("app_en.arb", { ok: "Hi {name}", broken: "{count, plural, one {x" }),
      "en",
    );
    expect(invalidIcuKeys).toEqual(["broken"]);
  });

  it("rejects invalid JSON as INVALID_JSON", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "verbatra-arb-")), "bad.arb");
    await writeFile(path, "{not json");
    expect(((await readError(adapter.read(path, "en"))) as AdapterError).code).toBe("INVALID_JSON");
  });

  it("rejects a non-object root as INVALID_STRUCTURE", async () => {
    const path = await tempArb("array.arb", ["not", "an", "object"]);
    expect(((await readError(adapter.read(path, "en"))) as AdapterError).code).toBe(
      "INVALID_STRUCTURE",
    );
  });

  it("reads metadata that carries numeric and nested leaves without rejecting it", async () => {
    // Real Flutter metadata holds non-string, deeply nested leaves, so a valid ARB file must not be rejected.
    const withRichMetadata = {
      "@@locale": "en",
      count: "{count, plural, one {# item} other {# items}}",
      "@count": {
        description: "Item count",
        placeholders: { count: { type: "int", optionalParameters: { decimalDigits: 2 } } },
      },
    };
    const path = await tempArb("app_en.arb", withRichMetadata);
    const { resource } = await adapter.read(path, "en");
    expect([...resource.entries.keys()]).toEqual(["count"]);
    expect(resource.entries.has("@count")).toBe(false);
  });
});

describe("createArbAdapter write (round-trip fidelity)", () => {
  it("preserves @-metadata and document order when writing back", async () => {
    const path = await tempArb("app_en.arb", SAMPLE);
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    const written = JSON.parse(await readFile(path, "utf8"));
    expect(Object.keys(written)).toEqual(["@@locale", "greeting", "@greeting", "items", "@items"]);
    expect(written["@greeting"]).toEqual(SAMPLE["@greeting"]);
    expect(written["@@locale"]).toBe("en");
  });

  it("overwrites message values with translations, keeping metadata intact", async () => {
    const path = await tempArb("app_de.arb", SAMPLE);
    const { resource } = await adapter.read(path, "en");
    const translated = new Map(resource.entries);
    const greeting = translated.get("greeting");
    if (greeting) {
      translated.set("greeting", { ...greeting, value: "Hallo {name}" });
    }
    await adapter.write({ ...resource, entries: translated }, path);
    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.greeting).toBe("Hallo {name}");
    expect(written["@greeting"]).toEqual(SAMPLE["@greeting"]);
  });

  it("writes messages only when the destination does not exist (fresh target)", async () => {
    const path = await tempArb("app_en.arb", SAMPLE);
    const { resource } = await adapter.read(path, "en");
    const fresh = join(await mkdtemp(join(tmpdir(), "verbatra-arb-")), "app_fr.arb");
    await adapter.write(resource, fresh);
    const written = JSON.parse(await readFile(fresh, "utf8"));
    expect(Object.keys(written)).toEqual(["greeting", "items"]);
  });

  it("round-trips metadata that carries numeric and nested leaves verbatim", async () => {
    const richMetadata = {
      description: "Item count",
      placeholders: { count: { type: "int", optionalParameters: { decimalDigits: 2 } } },
    };
    const path = await tempArb("app_en.arb", {
      "@@locale": "en",
      count: "{count, plural, one {# item} other {# items}}",
      "@count": richMetadata,
    });
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written["@count"]).toEqual(richMetadata);
    expect(written["@count"].placeholders.count.optionalParameters.decimalDigits).toBe(2);
    expect(Object.keys(written)).toEqual(["@@locale", "count", "@count"]);
  });

  it("round-trips a message key that contains a literal dot", async () => {
    const path = await tempArb("dotted.arb", { "page.title": "Welcome" });
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written).toEqual({ "page.title": "Welcome" });
  });
});
