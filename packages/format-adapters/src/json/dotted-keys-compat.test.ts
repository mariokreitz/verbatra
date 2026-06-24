import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentHash } from "@verbatra/core";
import { afterAll, describe, expect, it } from "vitest";
import { createI18nextJsonAdapter } from "../i18next/i18next-adapter.js";

const adapter = createI18nextJsonAdapter();
const dirs: string[] = [];

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "verbatra-compat-"));
  dirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

afterAll(() => {
  dirs.length = 0;
});

/**
 * A realistic dotted-free fixture: nested objects and flat keys, but no key segment
 * contains a literal dot. Its only dots are inside VALUES, which the change never touches.
 */
const DOTTED_FREE = [
  "{",
  '  "common": {',
  '    "greeting": "Hello {{name}}.",',
  '    "items_one": "{{count}} item",',
  '    "items_other": "{{count}} items"',
  "  },",
  '  "title": "Verbatra",',
  '  "ref": "See $t(common.greeting)"',
  "}",
  "",
].join("\n");

describe("compatibility: dotted-free files are unaffected", () => {
  it("writes byte-for-byte identical output (no re-nesting, no churn)", async () => {
    const inPath = await tempFile("in.json", DOTTED_FREE);
    const { resource } = await adapter.read(inPath, "en");
    const outPath = await tempFile("out.json", "");
    await adapter.write(resource, outPath);
    expect(await readFile(outPath, "utf8")).toBe(DOTTED_FREE);
  });

  it("produces the same map keys as the legacy plain-dotted flatten (no key re-encoding)", async () => {
    const inPath = await tempFile("in.json", DOTTED_FREE);
    const { resource } = await adapter.read(inPath, "en");
    expect([...resource.entries.keys()]).toEqual([
      "common.greeting",
      "common.items_one",
      "common.items_other",
      "title",
      "ref",
    ]);
  });

  it("keeps content hashes stable (the hash never depended on key encoding)", async () => {
    const inPath = await tempFile("in.json", DOTTED_FREE);
    const { resource } = await adapter.read(inPath, "en");
    // Hash is a pure function of content; these are the values the prior version produced,
    // since neither the canonicalized fields nor the map keys changed for a dotted-free file.
    const greeting = resource.entries.get("common.greeting");
    expect(greeting).toBeDefined();
    if (greeting) {
      const direct = contentHash({
        key: "anything-else",
        namespace: "different",
        value: "Hello {{name}}.",
        placeholders: ["{{name}}"],
        isPlural: false,
      });
      // Same content, different identity (key/namespace) -> identical hash, proving the
      // map-key encoding cannot influence the hash.
      expect(contentHash(greeting)).toBe(direct);
    }
  });

  it("is idempotent: a second read-write yields identical output and identical keys", async () => {
    const inPath = await tempFile("in.json", DOTTED_FREE);
    const first = await adapter.read(inPath, "en");
    const outPath = await tempFile("out.json", "");
    await adapter.write(first.resource, outPath);
    const second = await adapter.read(outPath, "en");
    const outPath2 = await tempFile("out2.json", "");
    await adapter.write(second.resource, outPath2);
    expect(await readFile(outPath2, "utf8")).toBe(DOTTED_FREE);
    expect([...second.resource.entries.keys()]).toEqual([...first.resource.entries.keys()]);
  });
});
