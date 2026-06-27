import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { createFlatFileAdapter, type FlatFileAdapterOptions } from "./flat-file-adapter.js";

function entry(key: string, value: string): TranslationEntry {
  return { key, namespace: "f", value, placeholders: [], isPlural: false };
}

const baseOptions: FlatFileAdapterOptions = {
  format: "xliff",
  extensions: [".flat"],
  parseEntries: (content, namespace) =>
    new Map(
      content
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => {
          const [key = "", value = ""] = line.split("=");
          return [key, entry(key, value)] as const;
        })
        .map(([key, e]) => [key, { ...e, namespace }] as const),
    ),
  serializeEntries: (entries) => [...entries.values()].map((e) => `${e.key}=${e.value}`).join("\n"),
  extractPlaceholders: () => [],
};

function makeAdapter(overrides: Partial<FlatFileAdapterOptions> = {}) {
  return createFlatFileAdapter({ ...baseOptions, ...overrides });
}

async function tempFile(name: string, content: string): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "verbatra-flat-")), name);
  await writeFile(path, content);
  return path;
}

async function readError(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

describe("createFlatFileAdapter", () => {
  it("detects by extension", () => {
    expect(makeAdapter().canHandle("a.flat")).toBe(true);
    expect(makeAdapter().canHandle("a.json")).toBe(false);
  });

  it("reads flat entries with the file basename as namespace", async () => {
    const adapter = makeAdapter();
    const { resource } = await adapter.read(await tempFile("msgs.flat", "a=1\nb=2"), "en");
    expect([...resource.entries.keys()]).toEqual(["a", "b"]);
    expect(resource.namespace).toBe("msgs");
    expect(resource.format).toBe("xliff");
  });

  it("rejects a non-regular path with INVALID_STRUCTURE", async () => {
    const dir = await mkdtemp(join(tmpdir(), "verbatra-flat-dir-"));
    const error = await readError(makeAdapter().read(dir, "en"));
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("wraps a non-AdapterError from parseEntries as INVALID_STRUCTURE", async () => {
    const adapter = makeAdapter({
      parseEntries: () => {
        throw new Error("raw /secret failure");
      },
    });
    const error = await readError(adapter.read(await tempFile("m.flat", "x"), "en"));
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
    expect((error as Error).message).not.toContain("/secret");
  });

  it("passes an AdapterError from parseEntries through unchanged", async () => {
    const adapter = makeAdapter({
      parseEntries: () => {
        throw new AdapterError("INVALID_XML", "bad xml");
      },
    });
    const error = await readError(adapter.read(await tempFile("m.flat", "x"), "en"));
    expect((error as AdapterError).code).toBe("INVALID_XML");
  });

  it("reports invalidIcuKeys from a supplied computeInvalidIcuKeys", async () => {
    const adapter = makeAdapter({ computeInvalidIcuKeys: (entries) => [...entries.keys()] });
    const { invalidIcuKeys } = await adapter.read(await tempFile("m.flat", "a=1"), "en");
    expect(invalidIcuKeys).toEqual(["a"]);
  });

  it("writes through serializeEntries atomically", async () => {
    const adapter = makeAdapter();
    const path = await tempFile("out.flat", "");
    await adapter.write(
      {
        locale: "en",
        namespace: "out",
        format: "xliff",
        entries: new Map([["k", entry("k", "v")]]),
      },
      path,
    );
    expect(await readFile(path, "utf8")).toBe("k=v");
  });

  it("defaults validateMessage to true and uses a supplied one", () => {
    expect(makeAdapter().validateMessage("x")).toBe(true);
    expect(makeAdapter({ validateMessage: (v) => v === "y" }).validateMessage("x")).toBe(false);
  });
});
