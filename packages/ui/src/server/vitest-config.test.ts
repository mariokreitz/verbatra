import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(new URL("../../vitest.config.ts", import.meta.url));
const configSource = readFileSync(configPath, "utf8");

describe("vitest.config.ts", () => {
  it("scopes tests and coverage to the server and client source trees", () => {
    expect(configSource).toContain('"src/server/**/*.test.ts"');
    expect(configSource).toContain('"src/client/**/*.test.ts"');
    expect(configSource).toContain('"src/server/**/*.ts"');
    expect(configSource).toContain('"src/client/**/*.ts"');
  });

  it("goes through the shared createVitestConfig preset", () => {
    expect(configSource).toContain("@verbatra/config/vitest");
    expect(configSource).toContain("createVitestConfig");
  });
});
