import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { RpcCallResult, RpcClient } from "../client/rpc-client.js";
import { rpcParamsSchemas } from "../shared/rpc/contract.js";
import type { ProjectSnapshotResult } from "../shared/rpc/snapshot.js";
import { type ModelContext, registerAgentTools, type WebMcpTool } from "./register-tools.js";

interface RecordedCall {
  readonly method: string;
  readonly params: unknown;
}

const READ_TOOLS = [
  "project.snapshot",
  "status.check",
  "status.diff",
  "glossary.get",
  "lock.state",
  "history.list",
  "key.integrity",
  "review.queue",
  "usage.summary",
  "key.value",
] as const;

const WRITE_AND_SPEND_TOOLS = [
  "translation.editEntry",
  "translation.retranslateEntry",
  "translation.translatePending",
] as const;

const SPEND_TOOLS = ["translation.retranslateEntry", "translation.translatePending"] as const;

const UNTRUSTED_TOOLS = [
  "status.diff",
  "glossary.get",
  "history.list",
  "key.integrity",
  "review.queue",
  "key.value",
  "translation.editEntry",
  "translation.retranslateEntry",
  "translation.translatePending",
] as const;

const TEXT_FREE_TOOLS = [
  "project.snapshot",
  "status.check",
  "lock.state",
  "usage.summary",
] as const;

function makeSnapshotResult(overrides: Partial<ProjectSnapshotResult> = {}): ProjectSnapshotResult {
  return {
    sourceLocale: "en",
    targetLocales: ["de"],
    format: "i18next-json",
    files: { pattern: "locales/{locale}.json" },
    provider: { id: "anthropic" },
    configSource: "override",
    glossary: { source: "none" },
    capabilities: { spend: false, writeToDisk: true },
    exposeAgentTools: true,
    ...overrides,
  };
}

/**
 * A mock rpc client that answers `project.snapshot` with the given envelope and echoes every other
 * method back, recording each call so a test can assert the delegation. Cast to the generic client
 * signature since the mock intentionally treats every method uniformly.
 */
function makeRpcClient(
  snapshot: RpcCallResult<"project.snapshot">,
  calls: RecordedCall[],
): RpcClient {
  const call = async (method: string, params: unknown): Promise<unknown> => {
    calls.push({ method, params });
    if (method === "project.snapshot") {
      return snapshot;
    }
    return { ok: true, result: { echoed: method } };
  };
  return { call } as RpcClient;
}

function makeModelContext(): { context: ModelContext; tools: WebMcpTool[] } {
  const tools: WebMcpTool[] = [];
  return {
    context: {
      registerTool: (tool) => {
        tools.push(tool);
      },
    },
    tools,
  };
}

function toolByName(tools: readonly WebMcpTool[], name: string): WebMcpTool {
  const tool = tools.find((candidate) => candidate.name === name);
  if (tool === undefined) {
    throw new Error(`tool not registered: ${name}`);
  }
  return tool;
}

/** The MCP-safe tool name a raw RPC method is expected to register under. */
function expectedName(method: string): string {
  return `verbatra_${method.replaceAll(".", "_")}`;
}

async function registerWith(
  snapshot: RpcCallResult<"project.snapshot">,
): Promise<{ tools: WebMcpTool[]; calls: RecordedCall[] }> {
  const calls: RecordedCall[] = [];
  const { context, tools } = makeModelContext();
  const rpcClient = makeRpcClient(snapshot, calls);
  await registerAgentTools({ modelContext: context, rpcClient, schemas: rpcParamsSchemas });
  return { tools, calls };
}

const SNAPSHOT_ON: RpcCallResult<"project.snapshot"> = {
  ok: true,
  result: makeSnapshotResult({ exposeAgentTools: true }),
};

const SNAPSHOT_ON_WITH_SPEND: RpcCallResult<"project.snapshot"> = {
  ok: true,
  result: makeSnapshotResult({
    exposeAgentTools: true,
    capabilities: { spend: true, writeToDisk: true },
  }),
};

describe("registerAgentTools no-ops", () => {
  it("registers nothing and never calls the rpc client when modelContext is absent", async () => {
    const calls: RecordedCall[] = [];
    const rpcClient = makeRpcClient(SNAPSHOT_ON, calls);

    await registerAgentTools({ modelContext: undefined, rpcClient, schemas: rpcParamsSchemas });

    expect(calls).toHaveLength(0);
  });

  it("registers nothing when the snapshot call fails", async () => {
    const { tools } = await registerWith({
      ok: false,
      error: { code: "SESSION_EXPIRED", message: "gone" },
    });

    expect(tools).toHaveLength(0);
  });

  it("registers nothing when exposeAgentTools is false", async () => {
    const { tools, calls } = await registerWith({
      ok: true,
      result: makeSnapshotResult({ exposeAgentTools: false }),
    });

    expect(tools).toHaveLength(0);
    expect(calls).toEqual([{ method: "project.snapshot", params: {} }]);
  });
});

describe("registerAgentTools registration set", () => {
  it("registers the ten read tools and the write tool, but no spend tool, when spend is false", async () => {
    const { tools } = await registerWith(SNAPSHOT_ON);
    const names = tools.map((tool) => tool.name);

    expect(tools).toHaveLength(11);
    for (const name of READ_TOOLS) {
      expect(names).toContain(expectedName(name));
    }
    expect(names).toContain(expectedName("translation.editEntry"));
    for (const name of SPEND_TOOLS) {
      expect(names).not.toContain(expectedName(name));
    }
  });

  it("registers all thirteen tools when spend is true", async () => {
    const { tools } = await registerWith(SNAPSHOT_ON_WITH_SPEND);
    const names = tools.map((tool) => tool.name);

    expect(tools).toHaveLength(13);
    for (const name of [...READ_TOOLS, ...WRITE_AND_SPEND_TOOLS]) {
      expect(names).toContain(expectedName(name));
    }
  });

  it("names every tool with the MCP-safe verbatra_ prefix and no dot", async () => {
    const { tools } = await registerWith(SNAPSHOT_ON_WITH_SPEND);
    const names = tools.map((tool) => tool.name);

    expect(names).toContain("verbatra_project_snapshot");
    expect(names).toContain("verbatra_key_value");
    expect(names).toContain("verbatra_translation_editEntry");
    expect(names).toContain("verbatra_translation_retranslateEntry");
    for (const name of names) {
      expect(name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
  });
});

describe("registerAgentTools annotations and input schema", () => {
  it("sets readOnlyHint and untrustedContentHint exactly as mapped", async () => {
    const { tools } = await registerWith(SNAPSHOT_ON_WITH_SPEND);

    for (const name of READ_TOOLS) {
      expect(toolByName(tools, expectedName(name)).annotations?.readOnlyHint).toBe(true);
    }
    for (const name of WRITE_AND_SPEND_TOOLS) {
      expect(toolByName(tools, expectedName(name)).annotations?.readOnlyHint).toBe(false);
    }
    for (const name of UNTRUSTED_TOOLS) {
      expect(toolByName(tools, expectedName(name)).annotations?.untrustedContentHint).toBe(true);
    }
    for (const name of TEXT_FREE_TOOLS) {
      expect(
        toolByName(tools, expectedName(name)).annotations?.untrustedContentHint,
      ).toBeUndefined();
    }
  });

  it("derives each tool's inputSchema from the injected params schema", async () => {
    const { tools } = await registerWith(SNAPSHOT_ON_WITH_SPEND);

    expect(toolByName(tools, expectedName("translation.editEntry")).inputSchema).toEqual(
      z.toJSONSchema(rpcParamsSchemas["translation.editEntry"]),
    );
    expect(toolByName(tools, expectedName("project.snapshot")).inputSchema).toEqual(
      z.toJSONSchema(rpcParamsSchemas["project.snapshot"]),
    );
  });
});

describe("registerAgentTools execute delegation", () => {
  it("delegates each execute to rpcClient.call with the tool's method and params, returning the stringified envelope", async () => {
    const { tools, calls } = await registerWith(SNAPSHOT_ON_WITH_SPEND);

    const cases = [
      { method: "key.value", params: { locale: "de", key: "greeting" } },
      {
        method: "translation.editEntry",
        params: { locale: "de", key: "greeting", value: "Hallo" },
      },
      { method: "translation.retranslateEntry", params: { locale: "de", key: "greeting" } },
    ];

    for (const { method, params } of cases) {
      const output = await toolByName(tools, expectedName(method)).execute(params);
      const forMethod = calls.filter((call) => call.method === method);

      expect(forMethod).toHaveLength(1);
      expect(forMethod.at(0)?.params).toEqual(params);
      expect(output).toBe(JSON.stringify({ ok: true, result: { echoed: method } }));
    }
  });
});
