import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = fileURLToPath(new URL("./retranslate-entry.ts", import.meta.url));

describe("static proof: retranslateEntry never reads a provider's environment directly", () => {
  const content = readFileSync(SOURCE_PATH, "utf8");

  it("never references process.env", () => {
    expect(content).not.toContain("process.env");
  });

  it("never references the PROVIDER_ENV table", () => {
    expect(content).not.toContain("PROVIDER_ENV");
  });

  it("reaches a provider only through selectProvider", () => {
    expect(content).toContain("selectProvider(");
    expect(content).not.toContain("buildProvider(");
  });
});
