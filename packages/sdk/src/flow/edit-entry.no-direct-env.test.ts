import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = fileURLToPath(new URL("./edit-entry.ts", import.meta.url));

/**
 * Static proof that editEntry never reads a provider's environment variable directly, and never
 * reaches a provider at all: unlike retranslateEntry, it does not even call selectProvider.
 * Mirrors retranslate-entry.no-direct-env.test.ts, scoped to this write seam.
 */
describe("static proof: editEntry never reaches or reads a provider", () => {
  const content = readFileSync(SOURCE_PATH, "utf8");

  it("never references process.env", () => {
    expect(content).not.toContain("process.env");
  });

  it("never references the PROVIDER_ENV table", () => {
    expect(content).not.toContain("PROVIDER_ENV");
  });

  it("never calls selectProvider or constructs a provider", () => {
    expect(content).not.toContain("selectProvider(");
    expect(content).not.toContain("buildProvider(");
    expect(content).not.toContain("translateBatch(");
  });
});
