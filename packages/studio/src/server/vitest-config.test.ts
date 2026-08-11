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

  it("discovers the React layer's tests", () => {
    expect(configSource).toContain('"src/app/**/*.test.tsx"');
  });

  it("measures the React layer, both its .ts modules and its .tsx components", () => {
    expect(configSource).toContain('"src/app/**/*.ts"');
    expect(configSource).toContain('"src/app/**/*.tsx"');
  });

  it("excludes the React layer's own test files from the measured sources", () => {
    // The shared preset excludes .test.ts only, so the .tsx half needs its own entry or every
    // app test file would be measured as if it were shipped source.
    expect(configSource).toContain('"src/**/*.test.tsx"');
  });

  it("names every src/app file it leaves unmeasured, so none is silently invisible", () => {
    for (const excluded of [
      "src/app/test-support.tsx",
      "src/app/main.tsx",
      "src/app/panel-props.ts",
      "src/app/css.d.ts",
    ]) {
      expect(configSource).toContain(`"${excluded}"`);
    }
  });

  it("goes through the shared createVitestConfig preset", () => {
    expect(configSource).toContain("@verbatra/config/vitest");
    expect(configSource).toContain("createVitestConfig");
  });

  it("never overrides the shared coverage thresholds", () => {
    expect(configSource).not.toContain("thresholds");
  });
});
