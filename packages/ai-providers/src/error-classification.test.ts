import { describe, expect, it } from "vitest";
import { classifyProviderError, getErrorStatus, isAbortError } from "./error-classification.js";

describe("classifyProviderError: by status", () => {
  it("classifies 429 as RATE_LIMITED", () => {
    expect(classifyProviderError({ status: 429 })).toBe("RATE_LIMITED");
  });

  it("classifies 401 and 403 as AUTH_FAILED", () => {
    expect(classifyProviderError({ status: 401 })).toBe("AUTH_FAILED");
    expect(classifyProviderError({ status: 403 })).toBe("AUTH_FAILED");
  });

  it("classifies 408 as TIMEOUT", () => {
    expect(classifyProviderError({ status: 408 })).toBe("TIMEOUT");
  });

  it("falls back to PROVIDER_ERROR for an unrecognized status", () => {
    expect(classifyProviderError({ status: 500 })).toBe("PROVIDER_ERROR");
  });
});

describe("classifyProviderError: by SDK error class name", () => {
  class RateLimitError extends Error {}
  class TooManyRequestsError extends Error {}
  class AuthenticationError extends Error {}
  class PermissionDeniedError extends Error {}
  class AuthorizationError extends Error {}
  class APIConnectionTimeoutError extends Error {}
  class ConnectionError extends Error {}
  class SomethingElse extends Error {}

  it("classifies openai/anthropic RateLimitError and deepl-node TooManyRequestsError as RATE_LIMITED", () => {
    expect(classifyProviderError(new RateLimitError())).toBe("RATE_LIMITED");
    expect(classifyProviderError(new TooManyRequestsError())).toBe("RATE_LIMITED");
  });

  it("classifies AuthenticationError, PermissionDeniedError, and deepl-node AuthorizationError as AUTH_FAILED", () => {
    expect(classifyProviderError(new AuthenticationError())).toBe("AUTH_FAILED");
    expect(classifyProviderError(new PermissionDeniedError())).toBe("AUTH_FAILED");
    expect(classifyProviderError(new AuthorizationError())).toBe("AUTH_FAILED");
  });

  it("classifies APIConnectionTimeoutError and deepl-node ConnectionError as TIMEOUT", () => {
    expect(classifyProviderError(new APIConnectionTimeoutError())).toBe("TIMEOUT");
    expect(classifyProviderError(new ConnectionError())).toBe("TIMEOUT");
  });

  it("falls back to PROVIDER_ERROR for an unrecognized class", () => {
    expect(classifyProviderError(new SomethingElse())).toBe("PROVIDER_ERROR");
  });
});

describe("classifyProviderError: never parses message text", () => {
  it("falls back to PROVIDER_ERROR for a plain Error whose message looks like a 429", () => {
    expect(classifyProviderError(new Error("429 Too Many Requests"))).toBe("PROVIDER_ERROR");
  });

  it("falls back to PROVIDER_ERROR for non-object, non-Error thrown values", () => {
    expect(classifyProviderError("a string throw")).toBe("PROVIDER_ERROR");
    expect(classifyProviderError(null)).toBe("PROVIDER_ERROR");
    expect(classifyProviderError(undefined)).toBe("PROVIDER_ERROR");
  });

  it("ignores a non-numeric status field", () => {
    expect(classifyProviderError({ status: "429" })).toBe("PROVIDER_ERROR");
  });
});

describe("getErrorStatus", () => {
  it("reads a numeric status property", () => {
    expect(getErrorStatus({ status: 503 })).toBe(503);
  });

  it("returns undefined for a missing, non-numeric, or absent-object status", () => {
    expect(getErrorStatus({})).toBeUndefined();
    expect(getErrorStatus({ status: "503" })).toBeUndefined();
    expect(getErrorStatus(null)).toBeUndefined();
    expect(getErrorStatus("nope")).toBeUndefined();
  });
});

describe("isAbortError", () => {
  it("is true when the signal is aborted, regardless of the error shape", () => {
    const controller = new AbortController();
    controller.abort();
    expect(isAbortError(new Error("anything"), controller.signal)).toBe(true);
  });

  it("is true for a native AbortError even without a signal", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"), undefined)).toBe(true);
  });

  it("is false for a non-abort error with no signal or an unaborted signal", () => {
    const controller = new AbortController();
    expect(isAbortError(new Error("plain failure"), undefined)).toBe(false);
    expect(isAbortError(new Error("plain failure"), controller.signal)).toBe(false);
  });

  it("is false for a non-Error thrown value with no aborted signal", () => {
    expect(isAbortError("a string throw", undefined)).toBe(false);
  });
});
