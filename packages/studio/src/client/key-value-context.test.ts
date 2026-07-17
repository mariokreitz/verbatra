import { describe, expect, it } from "vitest";
import { deriveKeyValueContext } from "./key-value-context.js";

describe("deriveKeyValueContext", () => {
  it("reports loaded with both source and target when the key exists in both", () => {
    const context = deriveKeyValueContext({
      ok: true,
      result: { source: "Hello", target: "Hallo" },
    });
    expect(context).toEqual({ kind: "loaded", source: "Hello", target: "Hallo" });
  });

  it("preserves an absent target as undefined, never coercing it to an empty string", () => {
    const context = deriveKeyValueContext({ ok: true, result: { source: "Hello" } });
    expect(context).toEqual({ kind: "loaded", source: "Hello", target: undefined });
    expect(context.kind === "loaded" && "target" in context).toBe(true);
  });

  it("reports error with the message for a transport or domain-error response", () => {
    const context = deriveKeyValueContext({
      ok: false,
      error: { code: "UNKNOWN_KEY", message: "The key was not found." },
    });
    expect(context).toEqual({ kind: "error", message: "The key was not found." });
  });
});
