import { describe, expect, it } from "vitest";
import { RPC_METHOD_NAMES } from "../shared/rpc/contract.js";
import type { RpcHandlerDeps } from "./rpc.js";
import { rpcHandlers } from "./rpc.js";
import { dispatchRpc } from "./rpc-gate.js";
import { baseUiConfig } from "./test-support.js";

describe("the shared contract's method list", () => {
  it("is exactly the six agreed methods", () => {
    expect(new Set(RPC_METHOD_NAMES)).toEqual(
      new Set([
        "project.snapshot",
        "status.check",
        "status.diff",
        "glossary.get",
        "lock.state",
        "history.list",
      ]),
    );
    expect(RPC_METHOD_NAMES).toHaveLength(6);
  });
});

describe("the handlers registry", () => {
  it("has keys that are a subset of the contract method list", () => {
    const contractSet = new Set(RPC_METHOD_NAMES);
    for (const method of Object.keys(rpcHandlers)) {
      expect(contractSet.has(method as (typeof RPC_METHOD_NAMES)[number])).toBe(true);
    }
  });

  it("has real handlers for project.snapshot, status.check, and status.diff only, so far", () => {
    expect(Object.keys(rpcHandlers)).toEqual(["project.snapshot", "status.check", "status.diff"]);
  });
});

function deps(): RpcHandlerDeps {
  return {
    config: { config: baseUiConfig(), source: { kind: "override" }, glossary: { source: "none" } },
    projectRoot: "/project",
  };
}

describe("dispatch for a contract method with no registered handler", () => {
  it.each([
    "glossary.get",
    "lock.state",
    "history.list",
  ])("answers METHOD_UNKNOWN for %s", async (method) => {
    const result = await dispatchRpc(Buffer.from(JSON.stringify({ method, params: {} })), deps());

    expect(result.statusCode).toBe(400);
    const parsed = JSON.parse(result.body) as { error: { code: string } };
    expect(parsed.error.code).toBe("METHOD_UNKNOWN");
  });
});
