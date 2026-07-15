import { describe, expect, it } from "vitest";
import { RPC_METHOD_NAMES, rpcParamsSchemas } from "./contract.js";

const EXPECTED_METHOD_NAMES = [
  "project.snapshot",
  "status.check",
  "status.diff",
  "glossary.get",
  "lock.state",
  "history.list",
  "key.integrity",
];

describe("RPC_METHOD_NAMES", () => {
  it("contains exactly the seven agreed method names, no more, no fewer", () => {
    expect(new Set(RPC_METHOD_NAMES)).toEqual(new Set(EXPECTED_METHOD_NAMES));
    expect(RPC_METHOD_NAMES).toHaveLength(EXPECTED_METHOD_NAMES.length);
  });
});

describe("rpcParamsSchemas", () => {
  it("has the same keys as RPC_METHOD_NAMES, same set, same length", () => {
    const schemaKeys = Object.keys(rpcParamsSchemas);
    expect(new Set(schemaKeys)).toEqual(new Set(RPC_METHOD_NAMES));
    expect(schemaKeys).toHaveLength(RPC_METHOD_NAMES.length);
  });

  it.each([
    ["project.snapshot", {}, { extra: true }],
    ["status.check", {}, { locales: [] }],
    ["status.diff", { locales: ["de"] }, { locales: [] }],
    ["glossary.get", {}, { extra: true }],
    ["lock.state", {}, { extra: true }],
    ["history.list", { limit: 5 }, { limit: 0 }],
    ["key.integrity", { key: "greeting" }, { key: "" }],
  ] as const)("%s accepts a valid shape and rejects an invalid shape", (method, valid, invalid) => {
    const schema = rpcParamsSchemas[method];
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});
