import { describe, expect, it } from "vitest";
import { RPC_METHOD_NAMES } from "../shared/rpc/contract.js";
import { createRpcHandlers } from "./rpc.js";

const READ_ONLY_METHODS = [
  "project.snapshot",
  "status.check",
  "status.diff",
  "glossary.get",
  "lock.state",
  "history.list",
  "key.integrity",
] as const;

describe("the shared contract's method list", () => {
  it("is exactly the eight agreed methods, including the schema-only write method", () => {
    expect(new Set(RPC_METHOD_NAMES)).toEqual(
      new Set([...READ_ONLY_METHODS, "translation.retranslateEntry"]),
    );
    expect(RPC_METHOD_NAMES).toHaveLength(8);
  });
});

describe("createRpcHandlers: capability gating", () => {
  it("always includes exactly the seven read handlers when neither capability is set", () => {
    const handlers = createRpcHandlers({ spend: false, writeToDisk: false });
    expect(new Set(Object.keys(handlers))).toEqual(new Set(READ_ONLY_METHODS));
    expect(Object.keys(handlers)).toHaveLength(READ_ONLY_METHODS.length);
  });

  it("still omits translation.retranslateEntry with only spend set", () => {
    const handlers = createRpcHandlers({ spend: true, writeToDisk: false });
    expect(handlers["translation.retranslateEntry"]).toBeUndefined();
    expect(Object.keys(handlers)).toHaveLength(READ_ONLY_METHODS.length);
  });

  it("still omits translation.retranslateEntry with only writeToDisk set", () => {
    const handlers = createRpcHandlers({ spend: false, writeToDisk: true });
    expect(handlers["translation.retranslateEntry"]).toBeUndefined();
    expect(Object.keys(handlers)).toHaveLength(READ_ONLY_METHODS.length);
  });

  it("includes translation.retranslateEntry only when both capabilities are set", () => {
    const handlers = createRpcHandlers({ spend: true, writeToDisk: true });
    expect(handlers["translation.retranslateEntry"]).toBeDefined();
    expect(new Set(Object.keys(handlers))).toEqual(new Set(RPC_METHOD_NAMES));
  });

  it("never mutates the read-only handlers across separate calls with different capabilities", () => {
    const off = createRpcHandlers({ spend: false, writeToDisk: false });
    const on = createRpcHandlers({ spend: true, writeToDisk: true });
    expect(off["project.snapshot"]).toBe(on["project.snapshot"]);
  });
});
