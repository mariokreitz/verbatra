import { describe, expect, it } from "vitest";
import { SSE_EVENT_REFRESH, SSE_EVENT_SHUTDOWN } from "./sse-events.js";

describe("SSE event names", () => {
  it("exposes the refresh and shutdown event name constants", () => {
    expect(SSE_EVENT_REFRESH).toBe("refresh");
    expect(SSE_EVENT_SHUTDOWN).toBe("shutdown");
  });
});
