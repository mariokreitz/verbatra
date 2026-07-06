import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let outDir = "";
let htmlFiles: string[] = [];

const INLINE_SCRIPT_WITH_BODY = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const STYLE_ELEMENT = /<style[^>]*>/i;
const EVENT_HANDLER_ATTRIBUTE = /\son[a-z]+\s*=/i;
const JAVASCRIPT_URL = /(?:href|src)\s*=\s*["']javascript:/i;

async function listHtmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("built SPA output", () => {
  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), "verbatra-ui-csp-dist-"));
    const { build } = await import("vite");
    const configFile = fileURLToPath(new URL("../../vite.config.ts", import.meta.url));
    await build({ configFile, build: { outDir, emptyOutDir: true } });
    htmlFiles = await listHtmlFiles(outDir);
  }, 60000);

  afterAll(async () => {
    if (outDir) {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("produces at least one built html file", () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
  });

  it("contains no inline script with a non-empty body", async () => {
    for (const file of htmlFiles) {
      const content = await readFile(file, "utf8");
      for (const match of content.matchAll(INLINE_SCRIPT_WITH_BODY)) {
        expect(match[1]?.trim()).toBe("");
      }
    }
  });

  it("contains no style element", async () => {
    for (const file of htmlFiles) {
      const content = await readFile(file, "utf8");
      expect(content).not.toMatch(STYLE_ELEMENT);
    }
  });

  it("contains no on* event handler attribute", async () => {
    for (const file of htmlFiles) {
      const content = await readFile(file, "utf8");
      expect(content).not.toMatch(EVENT_HANDLER_ATTRIBUTE);
    }
  });

  it("contains no javascript: URL", async () => {
    for (const file of htmlFiles) {
      const content = await readFile(file, "utf8");
      expect(content).not.toMatch(JAVASCRIPT_URL);
    }
  });
});
