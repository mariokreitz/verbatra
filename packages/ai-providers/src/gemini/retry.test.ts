import { describe, expect, it, vi } from "vitest";
import { withGeminiRetry } from "./retry.js";

/** A minimal status-bearing error, shaped like @google/genai's ApiError. */
class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("upstream detail");
    this.status = status;
  }
}

// Keep test runtime negligible: real timers with a tiny base delay, no fake-timer bookkeeping.
const FAST = { attempts: 3, baseDelayMs: 1 };

describe("withGeminiRetry: success paths", () => {
  it("returns the first attempt's value without retrying", async () => {
    const call = vi.fn(async () => "ok");
    await expect(withGeminiRetry(call, undefined, FAST)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 429 and returns the eventual success", async () => {
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(429))
      .mockResolvedValueOnce("ok");
    await expect(withGeminiRetry(call, undefined, FAST)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("retries a transient 503 and returns the eventual success", async () => {
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValueOnce("ok");
    await expect(withGeminiRetry(call, undefined, FAST)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("withGeminiRetry: exhaustion", () => {
  it("throws the last attempt's raw error, unwrapped, once attempts are exhausted", async () => {
    const errors = [new ApiError(429), new ApiError(429), new ApiError(429)];
    let index = 0;
    const call = vi.fn(() => {
      const error = errors[index] ?? errors[2];
      index += 1;
      return Promise.reject(error);
    });
    await expect(withGeminiRetry(call, undefined, FAST)).rejects.toBe(errors[2]);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("makes exactly `attempts` calls, never one more", async () => {
    const call = vi.fn(() => Promise.reject(new ApiError(500)));
    await expect(
      withGeminiRetry(call, undefined, { attempts: 2, baseDelayMs: 1 }),
    ).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("withGeminiRetry: non-retryable errors stop immediately", () => {
  it("does not retry a 401 (AUTH_FAILED-shaped)", async () => {
    const sentinel = new ApiError(401);
    const call = vi.fn(() => Promise.reject(sentinel));
    await expect(withGeminiRetry(call, undefined, FAST)).rejects.toBe(sentinel);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not retry a status-less error", async () => {
    const sentinel = new Error("network failure, no status");
    const call = vi.fn(() => Promise.reject(sentinel));
    await expect(withGeminiRetry(call, undefined, FAST)).rejects.toBe(sentinel);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("withGeminiRetry: cancellation", () => {
  it("stops retrying once the signal is already aborted, even for a retryable status", async () => {
    const controller = new AbortController();
    const sentinel = new ApiError(429);
    const call = vi.fn(() => {
      controller.abort();
      return Promise.reject(sentinel);
    });
    await expect(withGeminiRetry(call, controller.signal, FAST)).rejects.toBe(sentinel);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("returns early from the backoff wait once the signal aborts mid-delay", async () => {
    const controller = new AbortController();
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(429))
      .mockResolvedValueOnce("ok");
    const promise = withGeminiRetry(call, controller.signal, { attempts: 3, baseDelayMs: 60_000 });
    // Abort during the backoff wait; the delay must resolve immediately instead of after 60s.
    queueMicrotask(() => controller.abort());
    await expect(promise).resolves.toBe("ok");
  });
});

describe("withGeminiRetry: backoff timing", () => {
  it("doubles the delay on each successive retry", async () => {
    vi.useFakeTimers();
    try {
      const call = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new ApiError(429))
        .mockRejectedValueOnce(new ApiError(429))
        .mockResolvedValueOnce("ok");
      const promise = withGeminiRetry(call, undefined, { attempts: 3, baseDelayMs: 100 });
      await vi.advanceTimersByTimeAsync(0);
      expect(call).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(99);
      expect(call).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(call).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(199);
      expect(call).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(call).toHaveBeenCalledTimes(3);
      await expect(promise).resolves.toBe("ok");
    } finally {
      vi.useRealTimers();
    }
  });
});
