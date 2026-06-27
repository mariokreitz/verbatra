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

describe("reconcileResult: success", () => {
  it("returns a complete key-in equals key-out map for valid, exact output", () => {
    const result = reconcileResult(
      {
        translations: [
          { key: "a", value: "A" },
          { key: "b", value: "B" },
        ],
      },
      ["a", "b"],
    );
    expect(result.size).toBe(2);
    expect(result.get("a")).toBe("A");
    expect(result.get("b")).toBe("B");
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

describe("reconcileResult: reconciliation failures", () => {
  it("rejects an extra key as INVALID_RESPONSE", () => {
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

  it("rejects a duplicate key as INVALID_RESPONSE", () => {
    const error = reconcileError(
      {
        translations: [
          { key: "a", value: "A" },
          { key: "a", value: "A2" },
        ],
      },
      ["a"],
    );
    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it("rejects a missing key as INVALID_RESPONSE", () => {
    const error = reconcileError({ translations: [{ key: "a", value: "A" }] }, ["a", "b"]);
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
