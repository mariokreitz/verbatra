import { describe, expect, it } from "vitest";
import { entry } from "../testing/factories.js";
import { contentHash } from "./content-hash.js";

describe("contentHash", () => {
  it("is equal for equal content", () => {
    expect(contentHash(entry({ key: "a" }))).toBe(contentHash(entry({ key: "a" })));
  });

  it("differs when the value differs", () => {
    const a = entry({ key: "a", value: "one" });
    const b = entry({ key: "a", value: "two" });
    expect(contentHash(a)).not.toBe(contentHash(b));
  });

  it("is stable across repeated computation", () => {
    const e = entry({ key: "a", value: "stable", placeholders: ["{x}"] });
    expect(contentHash(e)).toBe(contentHash(e));
  });

  it("does not depend on placeholder order", () => {
    const a = entry({ key: "a", placeholders: ["{x}", "{y}"] });
    const b = entry({ key: "a", placeholders: ["{y}", "{x}"] });
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("ignores identity (key and namespace)", () => {
    const a = entry({ key: "a", namespace: "one", value: "same" });
    const b = entry({ key: "b", namespace: "two", value: "same" });
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("reflects a context change (description)", () => {
    const a = entry({ key: "a", value: "same" });
    const b = entry({ key: "a", value: "same", description: "ctx" });
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});
