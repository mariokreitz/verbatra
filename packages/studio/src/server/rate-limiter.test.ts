import { describe, expect, it } from "vitest";
import { createRpcRateLimiter } from "./rate-limiter.js";

describe("createRpcRateLimiter", () => {
  it("allows a method with no configured rule unconditionally", () => {
    const limiter = createRpcRateLimiter({});
    expect(limiter.tryAcquire("status.check")).toBe(true);
    expect(limiter.tryAcquire("status.check")).toBe(true);
  });

  it("allows calls up to maxCalls within the window, then trips", () => {
    const now = 0;
    const limiter = createRpcRateLimiter(
      { "translation.retranslateEntry": { windowMs: 1000, maxCalls: 3 } },
      () => now,
    );

    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(true);
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(true);
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(true);
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(false);
  });

  it("does not consume a slot for a call it rejects (repeated over-limit calls all trip)", () => {
    const now = 0;
    const limiter = createRpcRateLimiter(
      { "translation.retranslateEntry": { windowMs: 1000, maxCalls: 1 } },
      () => now,
    );

    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(true);
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(false);
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(false);
  });

  it("allows a call again once the window has rolled past the earlier calls", () => {
    let now = 0;
    const limiter = createRpcRateLimiter(
      { "translation.retranslateEntry": { windowMs: 1000, maxCalls: 1 } },
      () => now,
    );

    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(true);
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(false);
    now = 1001;
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(true);
  });

  it("tracks separately configured methods independently", () => {
    const now = 0;
    const limiter = createRpcRateLimiter(
      {
        "translation.retranslateEntry": { windowMs: 1000, maxCalls: 1 },
        "translation.editEntry": { windowMs: 1000, maxCalls: 1 },
      },
      () => now,
    );

    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(true);
    expect(limiter.tryAcquire("translation.editEntry")).toBe(true);
    expect(limiter.tryAcquire("translation.retranslateEntry")).toBe(false);
    expect(limiter.tryAcquire("translation.editEntry")).toBe(false);
  });
});
