import type { LoadedConfig } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import type { RpcHandlerDeps } from "../rpc.js";
import { baseStudioConfig } from "../test-support.js";
import { snapshotHandler } from "./snapshot.js";

describe("snapshotHandler", () => {
  it("delegates to the projection using the resolved config and project root", async () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig(),
      source: { kind: "override" },
      glossary: { source: "none" },
    };
    const deps: RpcHandlerDeps = { config: loaded, projectRoot: "/project" };

    const result = await snapshotHandler({}, deps);

    expect(result).toMatchObject({
      sourceLocale: "en",
      targetLocales: ["de"],
      provider: { id: "anthropic" },
      configSource: "override",
    });
  });

  it("projects exposeAgentTools false when deps omit it, and true when deps set it", async () => {
    const loaded: LoadedConfig = {
      config: baseStudioConfig(),
      source: { kind: "override" },
      glossary: { source: "none" },
    };

    const defaulted = await snapshotHandler({}, { config: loaded, projectRoot: "/project" });
    expect(defaulted.exposeAgentTools).toBe(false);

    const enabled = await snapshotHandler(
      {},
      { config: loaded, projectRoot: "/project", exposeAgentTools: true },
    );
    expect(enabled.exposeAgentTools).toBe(true);
  });
});
