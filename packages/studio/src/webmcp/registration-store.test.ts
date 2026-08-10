import { describe, expect, it } from "vitest";
import type { ToolRegistrationFailure } from "./registration-report.js";
import { createAgentToolsStatusStore } from "./registration-store.js";

const FAILURE: ToolRegistrationFailure = {
  tool: "verbatra_key_value",
  errorName: "SecurityError",
  message: "refused",
};

describe("createAgentToolsStatusStore", () => {
  it("starts empty", () => {
    expect(createAgentToolsStatusStore().getFailures()).toEqual([]);
  });

  it("exposes published failures and notifies every subscriber once", () => {
    const store = createAgentToolsStatusStore();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.publish([FAILURE]);

    expect(store.getFailures()).toEqual([FAILURE]);
    expect(notifications).toBe(1);
  });

  it("stays silent when a clean pass publishes nothing onto nothing", () => {
    const store = createAgentToolsStatusStore();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.publish([]);

    expect(store.getFailures()).toEqual([]);
    expect(notifications).toBe(0);
  });

  it("replaces the recorded failures on a later publish", () => {
    const store = createAgentToolsStatusStore();
    const other: ToolRegistrationFailure = {
      tool: "verbatra_lock_state",
      errorName: "InvalidStateError",
      message: "already registered",
    };

    store.publish([FAILURE]);
    store.publish([other]);

    expect(store.getFailures()).toEqual([other]);
  });

  it("stops notifying an unsubscribed listener", () => {
    const store = createAgentToolsStatusStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    unsubscribe();
    store.publish([FAILURE]);

    expect(notifications).toBe(0);
    expect(store.getFailures()).toEqual([FAILURE]);
  });
});
