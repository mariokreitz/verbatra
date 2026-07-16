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
  "translation.retranslateEntry",
  "review.queue",
  "translation.editEntry",
  "key.value",
  "translation.translatePending",
  "usage.summary",
];

describe("RPC_METHOD_NAMES", () => {
  it("contains exactly the thirteen agreed method names, no more, no fewer", () => {
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
    [
      "translation.retranslateEntry",
      { locale: "de", key: "greeting" },
      { locale: "", key: "greeting" },
    ],
    ["review.queue", {}, { extra: true }],
    [
      "translation.editEntry",
      { locale: "de", key: "greeting", value: "Hallo" },
      { locale: "de", key: "greeting" },
    ],
    ["key.value", { locale: "de", key: "greeting" }, { locale: "", key: "greeting" }],
    ["translation.translatePending", {}, { locale: "de" }],
    ["usage.summary", {}, { extra: true }],
  ] as const)("%s accepts a valid shape and rejects an invalid shape", (method, valid, invalid) => {
    const schema = rpcParamsSchemas[method];
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
  });

  it('declares no field capable of expressing "enable spend" or "enable write" on any method, read or write', () => {
    for (const method of RPC_METHOD_NAMES) {
      const shapeKeys = Object.keys(rpcParamsSchemas[method].shape);
      expect(shapeKeys).not.toContain("spend");
      expect(shapeKeys).not.toContain("writeToDisk");
    }
  });

  it("rejects a body that smuggles a spend or writeToDisk field alongside otherwise-valid params", () => {
    const result = rpcParamsSchemas["translation.retranslateEntry"].safeParse({
      locale: "de",
      key: "greeting",
      spend: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a translation.editEntry body that smuggles a writeToDisk field", () => {
    const result = rpcParamsSchemas["translation.editEntry"].safeParse({
      locale: "de",
      key: "greeting",
      value: "Hallo",
      writeToDisk: true,
    });
    expect(result.success).toBe(false);
  });
});
