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
  "review.queue",
] as const;

const WRITE_TO_DISK_ONLY_METHODS = ["translation.editEntry", "key.value"] as const;
const SPEND_AND_WRITE_METHODS = ["translation.retranslateEntry", "translation.translatePending"];

describe("the shared contract's method list", () => {
  it("is exactly the twelve agreed methods, including the schema-only write methods", () => {
    expect(new Set(RPC_METHOD_NAMES)).toEqual(
      new Set([...READ_ONLY_METHODS, ...SPEND_AND_WRITE_METHODS, ...WRITE_TO_DISK_ONLY_METHODS]),
    );
    expect(RPC_METHOD_NAMES).toHaveLength(12);
  });
});

describe("createRpcHandlers: capability gating", () => {
  it("always includes exactly the eight read handlers when neither capability is set", () => {
    const handlers = createRpcHandlers({ spend: false, writeToDisk: false });
    expect(new Set(Object.keys(handlers))).toEqual(new Set(READ_ONLY_METHODS));
    expect(Object.keys(handlers)).toHaveLength(READ_ONLY_METHODS.length);
  });

  it("still omits every write method with only spend set", () => {
    const handlers = createRpcHandlers({ spend: true, writeToDisk: false });
    expect(handlers["translation.retranslateEntry"]).toBeUndefined();
    expect(handlers["translation.translatePending"]).toBeUndefined();
    expect(handlers["translation.editEntry"]).toBeUndefined();
    expect(handlers["key.value"]).toBeUndefined();
    expect(Object.keys(handlers)).toHaveLength(READ_ONLY_METHODS.length);
  });

  it("includes translation.editEntry and key.value, but still omits translation.retranslateEntry and translation.translatePending, with only writeToDisk set", () => {
    const handlers = createRpcHandlers({ spend: false, writeToDisk: true });
    expect(handlers["translation.retranslateEntry"]).toBeUndefined();
    expect(handlers["translation.translatePending"]).toBeUndefined();
    expect(handlers["translation.editEntry"]).toBeDefined();
    expect(handlers["key.value"]).toBeDefined();
    expect(new Set(Object.keys(handlers))).toEqual(
      new Set([...READ_ONLY_METHODS, ...WRITE_TO_DISK_ONLY_METHODS]),
    );
  });

  it("includes every method, including translation.retranslateEntry and translation.translatePending, only when both capabilities are set", () => {
    const handlers = createRpcHandlers({ spend: true, writeToDisk: true });
    expect(handlers["translation.retranslateEntry"]).toBeDefined();
    expect(handlers["translation.translatePending"]).toBeDefined();
    expect(handlers["translation.editEntry"]).toBeDefined();
    expect(handlers["key.value"]).toBeDefined();
    expect(new Set(Object.keys(handlers))).toEqual(new Set(RPC_METHOD_NAMES));
  });

  it("never mutates the read-only handlers across separate calls with different capabilities", () => {
    const off = createRpcHandlers({ spend: false, writeToDisk: false });
    const on = createRpcHandlers({ spend: true, writeToDisk: true });
    expect(off["project.snapshot"]).toBe(on["project.snapshot"]);
  });
});
