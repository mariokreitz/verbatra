import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranslationEntry } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { createJsonFileAdapter, type JsonFileAdapterOptions } from "./json-file-adapter.js";

type IcuKeys = JsonFileAdapterOptions["computeInvalidIcuKeys"];

function makeAdapter(computeInvalidIcuKeys?: IcuKeys) {
  return createJsonFileAdapter({
    format: "next-intl-json",
    extractPlaceholders: () => [],
    deriveEntry: () => ({ placeholders: [], isPlural: false }),
    ...(computeInvalidIcuKeys ? { computeInvalidIcuKeys } : {}),
  });
}

async function tempFile(content: string): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "verbatra-jfa-")), "input.json");
  await writeFile(path, content);
  return path;
}

async function readError(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

describe("createJsonFileAdapter validateMessage", () => {
  it("defaults to true for every value when no validator is supplied (non-ICU formats)", () => {
    const adapter = makeAdapter();
    expect(adapter.validateMessage("anything {weird")).toBe(true);
    expect(adapter.validateMessage("")).toBe(true);
  });

  it("uses the supplied validator when one is provided", () => {
    const adapter = createJsonFileAdapter({
      format: "next-intl-json",
      extractPlaceholders: () => [],
      deriveEntry: () => ({ placeholders: [], isPlural: false }),
      validateMessage: (value) => value !== "bad",
    });
    expect(adapter.validateMessage("good")).toBe(true);
    expect(adapter.validateMessage("bad")).toBe(false);
  });
});

describe("createJsonFileAdapter read boundary", () => {
  it("rejects a non-regular path (directory) with a structured INVALID_STRUCTURE", async () => {
    const dir = await mkdtemp(join(tmpdir(), "verbatra-jfa-dir-"));
    const error = await readError(makeAdapter().read(dir, "en"));
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("surfaces a non-AdapterError from computeInvalidIcuKeys as a structured AdapterError", async () => {
    const adapter = makeAdapter((): readonly string[] => {
      throw new Error("analyzer blew up with a /secret/path");
    });
    const error = await readError(adapter.read(await tempFile('{"k":"v"}'), "en"));
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
    expect((error as Error).message).not.toContain("/secret/path");
  });

  it("passes an AdapterError from computeInvalidIcuKeys through unchanged", async () => {
    const adapter = makeAdapter((): readonly string[] => {
      throw new AdapterError("MAX_DEPTH_EXCEEDED", "too deep");
    });
    const error = await readError(adapter.read(await tempFile('{"k":"v"}'), "en"));
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("returns the keys computeInvalidIcuKeys reports for a valid file", async () => {
    const entries: string[] = [];
    const adapter = makeAdapter((map: ReadonlyMap<string, TranslationEntry>): readonly string[] => {
      entries.push(...map.keys());
      return [...map.keys()];
    });
    const { invalidIcuKeys } = await adapter.read(await tempFile('{"k":"v"}'), "en");
    expect(invalidIcuKeys).toEqual(["k"]);
    expect(entries).toEqual(["k"]);
  });
});
