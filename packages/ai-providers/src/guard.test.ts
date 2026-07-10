import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "./errors.js";
import {
  AUTH_FAILED_MESSAGE,
  guardProviderCall,
  PROVIDER_CALL_FAILED_MESSAGE,
  RATE_LIMITED_MESSAGE,
  TIMEOUT_MESSAGE,
} from "./guard.js";

/** A minimal status-bearing error, shaped like the openai/anthropic/@google/genai SDK error classes. */
class StatusError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("upstream detail that must never surface");
    this.status = status;
  }
}

/** A named class with no status, shaped like an SDK's dedicated timeout error class. */
class APIConnectionTimeoutError extends Error {}

describe("guardProviderCall: success", () => {
  it("returns the call's resolved value unchanged", async () => {
    await expect(guardProviderCall(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });
});

describe("guardProviderCall: classification by status code", () => {
  it("maps a 429 to RATE_LIMITED with the static message", async () => {
    const call = () => Promise.reject(new StatusError(429));
    await expect(guardProviderCall(call)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: RATE_LIMITED_MESSAGE,
    });
  });

  it("maps a 401 to AUTH_FAILED", async () => {
    const call = () => Promise.reject(new StatusError(401));
    await expect(guardProviderCall(call)).rejects.toMatchObject({
      code: "AUTH_FAILED",
      message: AUTH_FAILED_MESSAGE,
    });
  });

  it("maps a 403 to AUTH_FAILED", async () => {
    const call = () => Promise.reject(new StatusError(403));
    await expect(guardProviderCall(call)).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });

  it("maps a 408 to TIMEOUT", async () => {
    const call = () => Promise.reject(new StatusError(408));
    await expect(guardProviderCall(call)).rejects.toMatchObject({
      code: "TIMEOUT",
      message: TIMEOUT_MESSAGE,
    });
  });

  it("falls back to PROVIDER_ERROR for an unrecognized status", async () => {
    const call = () => Promise.reject(new StatusError(500));
    await expect(guardProviderCall(call)).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      message: PROVIDER_CALL_FAILED_MESSAGE,
    });
  });
});

describe("guardProviderCall: classification by SDK error class", () => {
  it("maps a status-less APIConnectionTimeoutError to TIMEOUT", async () => {
    const call = () => Promise.reject(new APIConnectionTimeoutError("connect timeout"));
    await expect(guardProviderCall(call)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("falls back to PROVIDER_ERROR for a plain, unclassified Error (never parses message text)", async () => {
    const call = () =>
      Promise.reject(new Error("401 x-api-key: sk-SECRET Authorization: Bearer sk-SECRET"));
    const rejection = await guardProviderCall(call).catch((error: unknown) => error);
    expect(rejection).toBeInstanceOf(ProviderError);
    expect((rejection as ProviderError).code).toBe("PROVIDER_ERROR");
    expect((rejection as ProviderError).message).toBe(PROVIDER_CALL_FAILED_MESSAGE);
  });
});

describe("guardProviderCall: secret-free messages", () => {
  it("never carries the raw error's message text into the thrown ProviderError", async () => {
    const call = () => Promise.reject(new StatusError(429));
    const rejection = await guardProviderCall(call).catch((error: unknown) => error);
    expect((rejection as ProviderError).message).not.toContain("upstream detail");
  });
});

describe("guardProviderCall: abort passthrough", () => {
  it("re-throws unchanged, not as a ProviderError, when the signal was already aborted before the call runs", async () => {
    const controller = new AbortController();
    controller.abort();
    const call = vi.fn(() => Promise.resolve("unreachable"));
    let caught: unknown;
    try {
      await guardProviderCall(call, controller.signal);
      expect.unreachable("should have thrown");
    } catch (error) {
      caught = error;
    }
    expect(caught).not.toBeInstanceOf(ProviderError);
    expect(call).not.toHaveBeenCalled();
  });

  it("re-throws the underlying error unchanged, not as a ProviderError, when the signal fires mid-flight", async () => {
    const controller = new AbortController();
    const sentinel = new Error("aborted by caller");
    sentinel.name = "AbortError";
    const call = () => {
      controller.abort();
      return Promise.reject(sentinel);
    };
    let caught: unknown;
    try {
      await guardProviderCall(call, controller.signal);
      expect.unreachable("should have thrown");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(sentinel);
  });

  it("recognizes a native AbortError even without a signal reference", async () => {
    const sentinel = new DOMException("This operation was aborted.", "AbortError");
    const call = () => Promise.reject(sentinel);
    let caught: unknown;
    try {
      await guardProviderCall(call);
      expect.unreachable("should have thrown");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(sentinel);
  });

  it("still classifies a non-abort error normally when a signal is passed but never aborted", async () => {
    const controller = new AbortController();
    const call = () => Promise.reject(new StatusError(429));
    await expect(guardProviderCall(call, controller.signal)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
