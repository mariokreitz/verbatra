import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { MAX_DEPTH, MAX_INPUT_BYTES } from "../json/limits.js";
import { createI18nextJsonAdapter } from "./i18next-adapter.js";

const adapter = createI18nextJsonAdapter();

async function tempFile(content: string | Uint8Array): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "verbatra-hard-"));
  const path = join(dir, "input.json");
  await writeFile(path, content);
  return path;
}

describe("placeholder extraction is linear (HIGH)", () => {
  it("handles a 200k unmatched '{{' value quickly and returns no placeholders", () => {
    const hostile = "{{".repeat(200_000);
    const start = Date.now();
    const result = adapter.extractPlaceholders(hostile);
    const elapsed = Date.now() - start;
    expect(result).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });

  it("still extracts well-formed placeholders unchanged", () => {
    expect(adapter.extractPlaceholders("{{name}} {{count}} {{val, number}} {{name}}")).toEqual([
      "{{name}}",
      "{{count}}",
      "{{val, number}}",
    ]);
    expect(adapter.extractPlaceholders("none")).toEqual([]);
  });
});

describe("read is bounded and fails structurally (MEDIUM)", () => {
  it("rejects over-deep nesting with a structured error, not a RangeError", async () => {
    const depth = MAX_DEPTH + 25;
    const content = `${'{"a":'.repeat(depth)}"x"${"}".repeat(depth)}`;
    const path = await tempFile(content);
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("MAX_DEPTH_EXCEEDED");
  });

  it("reads nesting within the depth limit", async () => {
    const depth = 50;
    const content = `${'{"a":'.repeat(depth)}"x"${"}".repeat(depth)}`;
    const path = await tempFile(content);
    const { resource } = await adapter.read(path, "en");
    expect(resource.entries.size).toBe(1);
  });

  it("rejects oversized input with INPUT_TOO_LARGE before parsing", async () => {
    const path = await tempFile(new Uint8Array(MAX_INPUT_BYTES + 1));
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INPUT_TOO_LARGE");
  });
});

describe("error hygiene (LOW)", () => {
  it("does not echo untrusted key paths in structure errors", async () => {
    const path = await tempFile('{"apiKeySecretName": 42}');
    const error = await adapter.read(path, "en").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
    expect((error as AdapterError).message).not.toContain("apiKeySecretName");
  });
});
