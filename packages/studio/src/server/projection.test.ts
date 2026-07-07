import type { LoadedConfig } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import { buildProjectSnapshot } from "./projection.js";
import { baseStudioConfig } from "./test-support.js";

const PROJECT_ROOT = "/home/user/project";

describe("buildProjectSnapshot", () => {
  it("projects only the allowlisted fields, never the raw config", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig(),
      source: { kind: "override" },
      glossary: { source: "none" },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot).toEqual({
      sourceLocale: "en",
      targetLocales: ["de"],
      format: "i18next-json",
      files: { pattern: "locales/{locale}.json" },
      provider: { id: "anthropic" },
      configSource: "override",
      glossary: { source: "none" },
    });
    expect(snapshot).not.toHaveProperty("prune");
    expect(snapshot).not.toHaveProperty("maxBatchSize");
    expect(JSON.stringify(snapshot)).not.toContain("options");
    expect(JSON.stringify(snapshot)).not.toContain("maxTokens");
  });

  it("relativizes a search-sourced config path against the project root", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig(),
      source: { kind: "search", filepath: `${PROJECT_ROOT}/verbatra.config.ts` },
      glossary: { source: "none" },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot.configSource).toBe("verbatra.config.ts");
  });

  it("relativizes an explicit config path the same way as a search result", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig(),
      source: { kind: "explicit", filepath: `${PROJECT_ROOT}/config/custom.config.ts` },
      glossary: { source: "none" },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot.configSource).toBe("config/custom.config.ts");
  });

  it("projects an inline glossary as source: inline, with no path", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig({ glossary: { hello: "hola" } }),
      source: { kind: "override" },
      glossary: { source: "inline" },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot.glossary).toEqual({ source: "inline" });
  });

  it("projects a file glossary with its path relativized against the project root", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig(),
      source: { kind: "override" },
      glossary: { source: "file", path: `${PROJECT_ROOT}/glossary.json` },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot.glossary).toEqual({ source: "file", path: "glossary.json" });
  });

  it("includes only the optional fields the config actually sets, never a synthesized default", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig({ tone: "formal", prune: true }),
      source: { kind: "override" },
      glossary: { source: "none" },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot.tone).toBe("formal");
    expect(snapshot.prune).toBe(true);
    expect(snapshot).not.toHaveProperty("generatePlurals");
    expect(snapshot).not.toHaveProperty("maxBatchSize");
  });

  it("includes an explicitly configured maxBatchSize and generatePlurals", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig({ maxBatchSize: 25, generatePlurals: true }),
      source: { kind: "override" },
      glossary: { source: "none" },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot.maxBatchSize).toBe(25);
    expect(snapshot.generatePlurals).toBe(true);
  });

  it("redacts a secret-shaped substring in a free-form config string", () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig({ sourceLocale: "sk-abcdEFGH12345678" }),
      source: { kind: "override" },
      glossary: { source: "none" },
    };

    const snapshot = buildProjectSnapshot(loaded, PROJECT_ROOT);

    expect(snapshot.sourceLocale).toBe("[REDACTED]");
  });
});
