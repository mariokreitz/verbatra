import { describe, expect, it } from "vitest";
import { RPC_METHOD_NAMES } from "../shared/rpc/contract.js";
import { rpcHandlers } from "./rpc.js";

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
  it("has keys exactly equal to the contract method list, now that every method has a real handler", () => {
    expect(new Set(Object.keys(rpcHandlers))).toEqual(new Set(RPC_METHOD_NAMES));
    expect(Object.keys(rpcHandlers)).toHaveLength(RPC_METHOD_NAMES.length);
  });
});
