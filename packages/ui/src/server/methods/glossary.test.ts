import type { LoadedConfig } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import type { RpcHandlerDeps } from "../rpc.js";
import { baseUiConfig } from "../test-support.js";
import { glossaryGetHandler } from "./glossary.js";

function deps(loaded: LoadedConfig, projectRoot = "/project"): RpcHandlerDeps {
  return { config: loaded, projectRoot };
}

describe("glossaryGetHandler", () => {
  it("reports source: none with no entries when the config has no glossary", async () => {
    const loaded: LoadedConfig = {
      config: baseUiConfig(),
      source: { kind: "override" },
      glossary: { source: "none" },
    };

    const result = await glossaryGetHandler({}, deps(loaded));

    expect(result).toEqual({ indicator: { source: "none" }, entries: {} });
  });

  it("reports source: inline with the inline entries", async () => {
    const loaded: LoadedConfig = {
      config: baseUiConfig({ glossary: { hello: "hola" } }),
      source: { kind: "override" },
      glossary: { source: "inline" },
    };

    const result = await glossaryGetHandler({}, deps(loaded));

    expect(result).toEqual({ indicator: { source: "inline" }, entries: { hello: "hola" } });
  });

  it("reports source: file with the path relativized against the project root", async () => {
    const loaded: LoadedConfig = {
      config: baseUiConfig({ glossary: { hello: "hola" } }),
      source: { kind: "override" },
      glossary: { source: "file", path: "/project/glossary.json" },
    };

    const result = await glossaryGetHandler({}, deps(loaded));

    expect(result.indicator).toEqual({ source: "file", path: "glossary.json" });
    expect(result.entries).toEqual({ hello: "hola" });
  });

  it("redacts a secret-shaped glossary value before it leaves the handler", async () => {
    const loaded: LoadedConfig = {
      config: baseUiConfig({ glossary: { apiTerm: "sk-abcdEFGH12345678" } }),
      source: { kind: "override" },
      glossary: { source: "inline" },
    };

    const result = await glossaryGetHandler({}, deps(loaded));

    expect(result.entries.apiTerm).toBe("[REDACTED]");
  });

  it("exposes only the indicator and entries, never the raw config", async () => {
    const loaded: LoadedConfig = {
      config: baseUiConfig({ glossary: { hello: "hola" } }),
      source: { kind: "override" },
      glossary: { source: "inline" },
    };

    const result = await glossaryGetHandler({}, deps(loaded));

    expect(Object.keys(result)).toEqual(["indicator", "entries"]);
    // baseUiConfig's default provider carries a model name and token limit; neither ever
    // reaches the response since the handler only ever projects the glossary field.
    expect(JSON.stringify(result)).not.toContain("test-model");
    expect(JSON.stringify(result)).not.toContain("maxTokens");
  });
});
