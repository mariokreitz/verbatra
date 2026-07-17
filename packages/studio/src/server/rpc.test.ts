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
  "usage.summary",
] as const;

/** Local-file write methods: always registered, since writing a locale file needs no flag. */
const ALWAYS_ON_WRITE_METHODS = ["translation.editEntry", "key.value"] as const;
/** Provider-calling methods: registered only when the spend capability is granted. */
const SPEND_METHODS = ["translation.retranslateEntry", "translation.translatePending"];

describe("the shared contract's method list", () => {
  it("is exactly the thirteen agreed methods, including the schema-only write methods", () => {
    expect(new Set(RPC_METHOD_NAMES)).toEqual(
      new Set([...READ_ONLY_METHODS, ...SPEND_METHODS, ...ALWAYS_ON_WRITE_METHODS]),
    );
    expect(RPC_METHOD_NAMES).toHaveLength(13);
  });
});

describe("createRpcHandlers: capability gating", () => {
  it("registers the nine read handlers plus translation.editEntry and key.value by default, without spend", () => {
    const handlers = createRpcHandlers({ spend: false, writeToDisk: true });
    expect(new Set(Object.keys(handlers))).toEqual(
      new Set([...READ_ONLY_METHODS, ...ALWAYS_ON_WRITE_METHODS]),
    );
  });

  it("omits translation.retranslateEntry and translation.translatePending without spend", () => {
    const handlers = createRpcHandlers({ spend: false, writeToDisk: true });
    expect(handlers["translation.retranslateEntry"]).toBeUndefined();
    expect(handlers["translation.translatePending"]).toBeUndefined();
    expect(handlers["translation.editEntry"]).toBeDefined();
    expect(handlers["key.value"]).toBeDefined();
  });

  it("includes every method, including translation.retranslateEntry and translation.translatePending, when spend is set", () => {
    const handlers = createRpcHandlers({ spend: true, writeToDisk: true });
    expect(handlers["translation.retranslateEntry"]).toBeDefined();
    expect(handlers["translation.translatePending"]).toBeDefined();
    expect(handlers["translation.editEntry"]).toBeDefined();
    expect(handlers["key.value"]).toBeDefined();
    expect(new Set(Object.keys(handlers))).toEqual(new Set(RPC_METHOD_NAMES));
  });

  it("never mutates the read-only handlers across separate calls with different capabilities", () => {
    const off = createRpcHandlers({ spend: false, writeToDisk: true });
    const on = createRpcHandlers({ spend: true, writeToDisk: true });
    expect(off["project.snapshot"]).toBe(on["project.snapshot"]);
  });

  it("keeps usage.summary reachable identically regardless of the spend flag", () => {
    const withoutSpend = createRpcHandlers({ spend: false, writeToDisk: true });
    const withSpend = createRpcHandlers({ spend: true, writeToDisk: true });

    expect(withoutSpend["usage.summary"]).toBeDefined();
    expect(withSpend["usage.summary"]).toBeDefined();
    expect(withoutSpend["usage.summary"]).toBe(withSpend["usage.summary"]);
  });
});
