import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { RpcCallResult, RpcClient } from "../client/rpc-client.js";
import { rpcParamsSchemas } from "../shared/rpc/contract.js";
import type { ProjectSnapshotResult } from "../shared/rpc/snapshot.js";
import { type ModelContext, registerAgentTools, type WebMcpTool } from "./register-tools.js";
import type { AgentToolsRegistration } from "./registration-report.js";

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

/** A stand-in for the browser's `DOMException`: only the structural `name` matters here. */
function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/**
 * A model context that refuses one named tool by throwing before it ever returns a promise, the
 * shape a host that validates its argument synchronously would take.
 */
function makeThrowingModelContext(refused: string): { context: ModelContext; tools: WebMcpTool[] } {
  const tools: WebMcpTool[] = [];
  return {
    context: {
      registerTool: (tool): void => {
        if (tool.name === refused) {
          throw namedError("SecurityError", "registration refused");
        }
        tools.push(tool);
      },
    },
    tools,
  };
}

/**
 * A model context that answers with a promise, as the specified surface does, and rejects one
 * named tool. A discarded return value here is a floating rejection no caller can catch.
 */
function makeRejectingModelContext(refused: string): {
  context: ModelContext;
  tools: WebMcpTool[];
} {
  const tools: WebMcpTool[] = [];
  return {
    context: {
      registerTool: (tool): Promise<void> => {
        if (tool.name === refused) {
          return Promise.reject(namedError("SecurityError", "registration refused"));
        }
        tools.push(tool);
        return Promise.resolve();
      },
    },
    tools,
  };
}

/** A promise-answering model context that rejects any name it has already accepted. */
function makeDuplicateRejectingModelContext(): { context: ModelContext; tools: WebMcpTool[] } {
  const tools: WebMcpTool[] = [];
  return {
    context: {
      registerTool: (tool): Promise<void> => {
        if (tools.some((registered) => registered.name === tool.name)) {
          return Promise.reject(namedError("InvalidStateError", "tool name already registered"));
        }
        tools.push(tool);
        return Promise.resolve();
      },
    },
    tools,
  };
}

async function registerWith(
  snapshot: RpcCallResult<"project.snapshot">,
): Promise<{ tools: WebMcpTool[]; calls: RecordedCall[]; registration: AgentToolsRegistration }> {
  const calls: RecordedCall[] = [];
  const { context, tools } = makeModelContext();
  const rpcClient = makeRpcClient(snapshot, calls);
  const registration = await registerAgentTools({
    modelContext: context,
    rpcClient,
    schemas: rpcParamsSchemas,
  });
  return { tools, calls, registration };
}

async function registerWithContext(
  snapshot: RpcCallResult<"project.snapshot">,
  context: ModelContext,
): Promise<AgentToolsRegistration> {
  return registerAgentTools({
    modelContext: context,
    rpcClient: makeRpcClient(snapshot, []),
    schemas: rpcParamsSchemas,
  });
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

describe("registerAgentTools registration report", () => {
  it("reports every attempted tool as registered when the surface accepts them all", async () => {
    const { registration } = await registerWith(SNAPSHOT_ON);

    expect(registration.attempted).toBe(11);
    expect(registration.registered).toHaveLength(11);
    expect(registration.failures).toEqual([]);
  });

  it("counts the two spend tools among the attempts once spend is granted", async () => {
    const { registration } = await registerWith(SNAPSHOT_ON_WITH_SPEND);

    expect(registration.attempted).toBe(13);
    expect(registration.failures).toEqual([]);
  });

  it("reports nothing attempted when the pass no-ops", async () => {
    const calls: RecordedCall[] = [];
    const withoutSurface = await registerAgentTools({
      modelContext: undefined,
      rpcClient: makeRpcClient(SNAPSHOT_ON, calls),
      schemas: rpcParamsSchemas,
    });
    const { registration: withoutOptIn } = await registerWith({
      ok: true,
      result: makeSnapshotResult({ exposeAgentTools: false }),
    });

    for (const registration of [withoutSurface, withoutOptIn]) {
      expect(registration).toEqual({ attempted: 0, registered: [], failures: [] });
    }
  });
});

describe("registerAgentTools failure reporting", () => {
  it("reports a synchronous throw and still registers every tool after it", async () => {
    const refused = expectedName("status.diff");
    const { context, tools } = makeThrowingModelContext(refused);

    const registration = await registerWithContext(SNAPSHOT_ON, context);
    const registeredNames = tools.map((tool) => tool.name);

    expect(registration.attempted).toBe(11);
    expect(registration.registered).toHaveLength(10);
    expect(registration.failures).toEqual([
      { tool: refused, errorName: "SecurityError", message: "registration refused" },
    ]);
    expect(registeredNames).not.toContain(refused);
    expect(registeredNames).toContain(expectedName("key.value"));
    expect(registeredNames).toContain(expectedName("translation.editEntry"));
  });

  it("reports a rejected registration and leaves no unhandled rejection behind", async () => {
    const refused = expectedName("status.diff");
    const { context, tools } = makeRejectingModelContext(refused);
    const escaped: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      escaped.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      const registration = await registerWithContext(SNAPSHOT_ON, context);
      await new Promise((resolve) => setImmediate(resolve));

      expect(escaped).toEqual([]);
      expect(registration.failures).toEqual([
        { tool: refused, errorName: "SecurityError", message: "registration refused" },
      ]);
      expect(registration.registered).toHaveLength(10);
      expect(tools.map((tool) => tool.name)).toContain(expectedName("key.value"));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("catches a duplicate registration as an InvalidStateError rather than letting it escape", async () => {
    const { context, tools } = makeDuplicateRejectingModelContext();

    const first = await registerWithContext(SNAPSHOT_ON, context);
    const second = await registerWithContext(SNAPSHOT_ON, context);

    expect(first.failures).toEqual([]);
    expect(first.registered).toHaveLength(11);
    expect(second.registered).toEqual([]);
    expect(second.failures).toHaveLength(11);
    expect(new Set(second.failures.map((failure) => failure.errorName))).toEqual(
      new Set(["InvalidStateError"]),
    );
    expect(second.failures.map((failure) => failure.tool)).toContain(
      expectedName("project.snapshot"),
    );
    expect(tools).toHaveLength(11);
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
