import { describe, expect, it } from "vitest";
import type { RefreshEvent } from "./sse-events.js";
import { SSE_EVENT_REFRESH, SSE_EVENT_SHUTDOWN } from "./sse-events.js";

describe("SSE event names", () => {
  it("exposes the refresh and shutdown event name constants", () => {
    expect(SSE_EVENT_REFRESH).toBe("refresh");
    expect(SSE_EVENT_SHUTDOWN).toBe("shutdown");
  });
});

describe("RefreshEvent payload shape", () => {
  it("a fully populated event carries only reason, at, locale, and numeric delta counts, never a key name or a value", () => {
    const event: RefreshEvent = {
      reason: "targets",
      at: "2026-01-01T00:00:00.000Z",
      locale: "de",
      delta: { added: 1, changed: 2, removed: 3 },
    };

    expect(Object.keys(event).sort()).toEqual(["at", "delta", "locale", "reason"]);
    expect(Object.keys(event.delta as NonNullable<RefreshEvent["delta"]>).sort()).toEqual([
      "added",
      "changed",
      "removed",
    ]);
    for (const value of Object.values(event.delta as NonNullable<RefreshEvent["delta"]>)) {
      expect(typeof value).toBe("number");
    }
  });

  it("a lock event carries only reason and at, no locale or delta field at all", () => {
    const event: RefreshEvent = { reason: "lock", at: "2026-01-01T00:00:00.000Z" };

    expect(Object.keys(event).sort()).toEqual(["at", "reason"]);
  });
});
