import { describe, expect, it } from "vitest";
import { ProviderError } from "../errors.js";
import { reconcileResult } from "./response.js";

/** Run reconcileResult expecting it to throw, returning the ProviderError it raised. */
function reconcileError(raw: unknown, requestedKeys: readonly string[]): ProviderError {
  try {
    reconcileResult(raw, requestedKeys);
  } catch (error) {
    if (error instanceof ProviderError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected reconcileResult to throw");
}

describe("reconcileResult: clean pass-through", () => {
  it("accepts every key with no missing keys for valid, exact output", () => {
    const result = reconcileResult(
      {
        translations: [
          { key: "a", value: "A" },
          { key: "b", value: "B" },
        ],
      },
      ["a", "b"],
    );
    expect(result.accepted.size).toBe(2);
    expect(result.accepted.get("a")).toBe("A");
    expect(result.accepted.get("b")).toBe("B");
    expect(result.missingKeys).toEqual([]);
  });
});

describe("reconcileResult: schema validation boundary", () => {
  it("rejects a malformed payload as a secret-free INVALID_RESPONSE", () => {
    const error = reconcileError({ translations: "not-an-array" }, ["a"]);
    expect(error.code).toBe("INVALID_RESPONSE");
    expect(error.message).toBe("The provider returned a malformed translation payload.");
  });

  it("rejects output whose entries lack the required shape", () => {
    const error = reconcileError({ translations: [{ key: "a" }] }, ["a"]);
    expect(error.code).toBe("INVALID_RESPONSE");
  });
});

describe("reconcileResult: bounded partial accept", () => {
  it("accepts the well-formed remainder and reports a missing key instead of throwing", () => {
    const result = reconcileResult({ translations: [{ key: "a", value: "A" }] }, ["a", "b"]);
    expect(result.accepted.get("a")).toBe("A");
    expect(result.missingKeys).toEqual(["b"]);
  });

  it("accepts the well-formed remainder and reports a duplicated key instead of throwing", () => {
    const result = reconcileResult(
      {
        translations: [
          { key: "a", value: "A" },
          { key: "b", value: "B1" },
          { key: "b", value: "B2" },
        ],
      },
      ["a", "b"],
    );
    expect(result.accepted.get("a")).toBe("A");
    expect(result.accepted.has("b")).toBe(false);
    expect(result.missingKeys).toEqual(["b"]);
  });

  it("reports every offending key when both missing and duplicated keys are present", () => {
    const result = reconcileResult(
      {
        translations: [
          { key: "a", value: "A" },
          { key: "b", value: "B1" },
          { key: "b", value: "B2" },
        ],
      },
      ["a", "b", "c"],
    );
    expect(result.accepted.get("a")).toBe("A");
    expect([...result.missingKeys].sort()).toEqual(["b", "c"]);
  });
});

describe("reconcileResult: hallucinated-key hard rejection", () => {
  it("rejects an unrequested key immediately instead of partial-accepting around it", () => {
    const error = reconcileError(
      {
        translations: [
          { key: "a", value: "A" },
          { key: "z", value: "Z" },
        ],
      },
      ["a"],
    );
    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it("rejects an unrequested key even when every requested key is also present and well-formed", () => {
    const error = reconcileError(
      {
        translations: [
          { key: "a", value: "A" },
          { key: "b", value: "B" },
          { key: "hallucinated", value: "not requested" },
        ],
      },
      ["a", "b"],
    );
    expect(error.code).toBe("INVALID_RESPONSE");
  });
});

describe("reconcileResult: secret-free errors", () => {
  it("never leaks a returned key or translatable content into the error message", () => {
    const secretValue = "sk-secret-CONTENT-123";
    const secretKey = "LEAKED_SECRET_KEY";
    const error = reconcileError({ translations: [{ key: secretKey, value: secretValue }] }, ["a"]);
    expect(error.code).toBe("INVALID_RESPONSE");
    expect(error.message).not.toContain(secretValue);
    expect(error.message).not.toContain(secretKey);
  });
});
