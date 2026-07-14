import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentHash, diffResources, type LocaleResource } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { createArbAdapter } from "../arb/arb-adapter.js";
import { createI18nextJsonAdapter } from "../i18next/i18next-adapter.js";
import { createYamlAdapter } from "../yaml/yaml-adapter.js";
import { createJsonFileAdapter } from "./json-file-adapter.js";

async function tempFile(dirPrefix: string, name: string, content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), dirPrefix));
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

describe("non-string leaf policy: JSON adapter (i18next)", () => {
  const adapter = createI18nextJsonAdapter();
  const MIXED = '{"greeting":"Hi","count":5,"enabled":true,"active":null}';

  it("reads successfully end to end, excluding non-string leaves from entries", async () => {
    const path = await tempFile("verbatra-nsl-json-", "in.json", MIXED);
    const { resource, excludedLeafPaths } = await adapter.read(path, "en");
    expect([...resource.entries.keys()]).toEqual(["greeting"]);
    expect([...excludedLeafPaths].sort()).toEqual(["active", "count", "enabled"]);
  });

  it("does not include the excluded leaves when the resource is written back", async () => {
    const path = await tempFile("verbatra-nsl-json-", "in.json", MIXED);
    const { resource } = await adapter.read(path, "en");
    const outPath = await tempFile("verbatra-nsl-json-", "out.json", "");
    await adapter.write(resource, outPath);
    const written = JSON.parse(await readFile(outPath, "utf8"));
    expect(written).toEqual({ greeting: "Hi" });
  });

  it("produces an empty excludedLeafPaths list for a file with no non-string leaves", async () => {
    const path = await tempFile("verbatra-nsl-json-", "in.json", '{"greeting":"Hi"}');
    const { excludedLeafPaths } = await adapter.read(path, "en");
    expect(excludedLeafPaths).toEqual([]);
  });
});

describe("non-string leaf policy: YAML adapter", () => {
  const adapter = createYamlAdapter();
  const MIXED = "greeting: Hi\ncount: 5\nenabled: true\nactive: null\n";

  it("reads successfully end to end, excluding non-string leaves from entries", async () => {
    const path = await tempFile("verbatra-nsl-yaml-", "in.yml", MIXED);
    const { resource, excludedLeafPaths } = await adapter.read(path, "en");
    expect([...resource.entries.keys()]).toEqual(["greeting"]);
    expect([...excludedLeafPaths].sort()).toEqual(["active", "count", "enabled"]);
  });

  it("does not include the excluded leaves when the resource is written back", async () => {
    const path = await tempFile("verbatra-nsl-yaml-", "in.yml", MIXED);
    const { resource } = await adapter.read(path, "en");
    const outPath = await tempFile("verbatra-nsl-yaml-", "out.yml", "");
    await adapter.write(resource, outPath);
    const written = await readFile(outPath, "utf8");
    expect(written).toContain("greeting: Hi");
    expect(written).not.toContain("count");
    expect(written).not.toContain("enabled");
    expect(written).not.toContain("active");
  });
});

describe("non-string leaf policy: ARB adapter", () => {
  const adapter = createArbAdapter();
  const MIXED = {
    "@@locale": "en",
    greeting: "Hi {name}",
    "@greeting": { description: "A greeting" },
    revision: 3,
    published: false,
    reviewer: null,
  };

  it("reads successfully end to end, excluding non-string leaves and stripped metadata", async () => {
    const path = await tempFile("verbatra-nsl-arb-", "app_en.arb", JSON.stringify(MIXED));
    const { resource, excludedLeafPaths } = await adapter.read(path, "en");
    expect([...resource.entries.keys()]).toEqual(["greeting"]);
    expect([...excludedLeafPaths].sort()).toEqual(["published", "reviewer", "revision"]);
  });

  it("does not include the excluded leaves when the resource is written back", async () => {
    const path = await tempFile("verbatra-nsl-arb-", "app_en.arb", JSON.stringify(MIXED));
    const { resource } = await adapter.read(path, "en");
    await adapter.write(resource, path);
    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written).not.toHaveProperty("revision");
    expect(written).not.toHaveProperty("published");
    expect(written).not.toHaveProperty("reviewer");
    expect(written.greeting).toBe("Hi {name}");
  });
});

describe("non-string leaf policy: excluded leaves never reach downstream processing", () => {
  const MIXED = '{"greeting":"Hi","count":5,"enabled":true,"active":null}';

  it("never passes an excluded leaf to extractPlaceholders or computeInvalidIcuKeys", async () => {
    const seenByCompute: string[] = [];
    const adapter = createJsonFileAdapter({
      format: "next-intl-json",
      extractPlaceholders: () => [],
      deriveEntry: () => ({ placeholders: [], isPlural: false }),
      computeInvalidIcuKeys: (entries) => {
        seenByCompute.push(...entries.keys());
        return [];
      },
    });
    const path = await tempFile("verbatra-nsl-boundary-", "in.json", MIXED);
    const { resource, excludedLeafPaths } = await adapter.read(path, "en");
    expect(seenByCompute).toEqual(["greeting"]);
    for (const excludedPath of excludedLeafPaths) {
      expect(seenByCompute).not.toContain(excludedPath);
    }
    expect(resource.entries.has("count")).toBe(false);
  });

  it("never appears in a TranslateRequest-shaped entry list built from the flattened entries", async () => {
    const adapter = createI18nextJsonAdapter();
    const path = await tempFile("verbatra-nsl-boundary-", "in.json", MIXED);
    const { resource, excludedLeafPaths } = await adapter.read(path, "en");
    const requestEntries = [...resource.entries.values()].map((entry) => ({
      key: entry.key,
      value: entry.value,
    }));
    expect(requestEntries).toEqual([{ key: "greeting", value: "Hi" }]);
    for (const excludedPath of excludedLeafPaths) {
      expect(requestEntries.some((entry) => entry.key === excludedPath)).toBe(false);
    }
  });

  it("never contributes a hash or diff entry: contentHash and diffResources only see translatable entries", async () => {
    const adapter = createI18nextJsonAdapter();
    const path = await tempFile("verbatra-nsl-boundary-", "in.json", MIXED);
    const { resource } = await adapter.read(path, "en");
    for (const entry of resource.entries.values()) {
      expect(() => contentHash(entry)).not.toThrow();
    }
    const empty: LocaleResource = {
      locale: "de",
      namespace: resource.namespace,
      format: resource.format,
      entries: new Map(),
    };
    const diff = diffResources(resource, empty);
    expect(diff.missing).toEqual(["greeting"]);
  });
});
