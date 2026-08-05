import { describe, expect, it } from "vitest";
import { describeError, errorMessage, SdkError } from "./errors.js";

describe("errorMessage", () => {
  it("takes an Error's own message", () => {
    expect(errorMessage(new Error("provider blew up"))).toBe("provider blew up");
  });

  it("stringifies a thrown non-Error rather than yielding undefined", () => {
    expect(errorMessage("raw failure")).toBe("raw failure");
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(undefined)).toBe("undefined");
    expect(errorMessage({ message: "not an Error" })).toBe("[object Object]");
  });

  it("reads the message of an SdkError like any other Error", () => {
    expect(errorMessage(new SdkError("SOURCE_INVALID", "unreadable"))).toBe("unreadable");
  });
});

describe("describeError", () => {
  it("preserves a string code carried on an Error", () => {
    const error = Object.assign(new Error("provider blew up"), { code: "PROVIDER_ERROR" });

    expect(describeError(error, "LOCALE_FAILED")).toEqual({
      code: "PROVIDER_ERROR",
      message: "provider blew up",
    });
  });

  it("falls back when an Error's code is not a string", () => {
    const error = Object.assign(new Error("coded oddly"), { code: 500 });

    expect(describeError(error, "LOCALE_FAILED")).toEqual({
      code: "LOCALE_FAILED",
      message: "coded oddly",
    });
  });

  it("falls back for an Error with no code at all", () => {
    expect(describeError(new Error("plain"), "LOCALE_FAILED")).toEqual({
      code: "LOCALE_FAILED",
      message: "plain",
    });
  });

  it("stringifies a non-Error value under the fallback", () => {
    expect(describeError("raw failure", "LOCALE_FAILED")).toEqual({
      code: "LOCALE_FAILED",
      message: "raw failure",
    });
    expect(describeError(42, "LOCALE_FAILED")).toEqual({ code: "LOCALE_FAILED", message: "42" });
  });

  it("keeps the two call sites' fallbacks distinct, which is why it takes a parameter", () => {
    const plain = new Error("something went wrong");

    expect(describeError(plain, "WATCH_RUN_FAILED").code).toBe("WATCH_RUN_FAILED");
    expect(describeError(plain, "LOCALE_FAILED").code).toBe("LOCALE_FAILED");
  });

  it("reads an SdkError's own code in preference to the fallback", () => {
    expect(describeError(new SdkError("LOCK_CONTENDED", "held"), "LOCALE_FAILED")).toEqual({
      code: "LOCK_CONTENDED",
      message: "held",
    });
  });
});
