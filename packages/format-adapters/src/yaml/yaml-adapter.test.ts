import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { AdapterError } from "../errors.js";
import { MAX_DEPTH } from "../json/limits.js";
import { createYamlAdapter } from "./yaml-adapter.js";

const adapter = createYamlAdapter();

async function tempFile(name: string, content: string): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "verbatra-yaml-")), name);
  await writeFile(path, content);
  return path;
}

async function readError(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

describe("createYamlAdapter detection", () => {
  it("handles .yml and .yaml, not other extensions", () => {
    expect(adapter.canHandle("en.yml")).toBe(true);
    expect(adapter.canHandle("en.yaml")).toBe(true);
    expect(adapter.canHandle("en.json")).toBe(false);
  });

  it("detects by extension only, ignoring any sample", () => {
    expect(adapter.canHandle("en.yml", "not yaml at all")).toBe(true);
  });

  it("reports format yaml", () => {
    expect(adapter.format).toBe("yaml");
  });
});

describe("createYamlAdapter read", () => {
  it("flattens nested YAML and extracts double-brace placeholders", async () => {
    const path = await tempFile("en.yml", "greeting: Hello {{name}}\nnested:\n  title: Welcome\n");
    const { resource, invalidIcuKeys } = await adapter.read(path, "en");
    const greeting = resource.entries.get("greeting");
    expect(greeting?.value).toBe("Hello {{name}}");
    expect(greeting?.placeholders).toEqual(["{{name}}"]);
    expect(greeting?.isPlural).toBe(false);
    expect(resource.entries.get("nested.title")?.value).toBe("Welcome");
    expect(invalidIcuKeys).toEqual([]);
  });

  it("reports malformed YAML as INVALID_YAML", async () => {
    const error = await readError(adapter.read(await tempFile("bad.yml", "a: [unclosed\n"), "en"));
    expect((error as AdapterError).code).toBe("INVALID_YAML");
  });

  it("rejects a non-object root as INVALID_STRUCTURE", async () => {
    const error = await readError(adapter.read(await tempFile("seq.yml", "- a\n- b\n"), "en"));
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("rejects a non-string leaf (a YAML number) as INVALID_STRUCTURE", async () => {
    const error = await readError(adapter.read(await tempFile("num.yml", "count: 5\n"), "en"));
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("rejects nesting beyond the depth cap as MAX_DEPTH_EXCEEDED", async () => {
    let value = "v";
    for (let i = 0; i < MAX_DEPTH + 1; i += 1) {
      value = `{k: ${value}}`;
    }
    const error = await readError(
      adapter.read(await tempFile("deep.yml", `root: ${value}\n`), "en"),
    );
    expect((error as AdapterError).code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("bounds anchor-alias expansion (billion-laughs is rejected, not expanded)", async () => {
    const bomb = [
      "a: &a hello",
      "b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]",
      "c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]",
      "d: [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]",
      "",
    ].join("\n");
    const error = await readError(adapter.read(await tempFile("bomb.yml", bomb), "en"));
    expect(error).toBeInstanceOf(AdapterError);
  });
});

describe("createYamlAdapter write (round-trip)", () => {
  it("writes nested YAML that reparses to the same structure", async () => {
    const path = await tempFile("en.yml", "greeting: Hello\nnested:\n  title: Welcome\n");
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    const written = await readFile(path, "utf8");
    expect(parseYaml(written)).toEqual({ greeting: "Hello", nested: { title: "Welcome" } });
  });
});
