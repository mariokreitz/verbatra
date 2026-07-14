import { describe, expect, it } from "vitest";
import {
  budgetExceededNotice,
  checkBudgetTrip,
  createBudgetTracker,
  foldTrackerUsage,
  toBudgetSummary,
} from "./budget.js";

describe("createBudgetTracker / toBudgetSummary", () => {
  it("returns undefined when no maxTokens is configured", () => {
    const tracker = createBudgetTracker(undefined, "warn");
    expect(toBudgetSummary(tracker)).toBeUndefined();
  });

  it("starts inert: supported false, tokensUsed 0, exceeded false", () => {
    const tracker = createBudgetTracker(100, "warn");
    expect(toBudgetSummary(tracker)).toEqual({
      maxTokens: 100,
      behavior: "warn",
      supported: false,
      tokensUsed: 0,
      exceeded: false,
    });
  });
});

describe("foldTrackerUsage", () => {
  it("contributes nothing when usage is absent", () => {
    const tracker = createBudgetTracker(100, "warn");
    foldTrackerUsage(tracker, undefined);
    expect(tracker.tokensUsed).toBe(0);
    expect(tracker.usageSeen).toBe(false);
  });

  it("sums input and output tokens and marks usage as seen", () => {
    const tracker = createBudgetTracker(100, "warn");
    foldTrackerUsage(tracker, { inputTokens: 10, outputTokens: 5 });
    foldTrackerUsage(tracker, { inputTokens: 3, outputTokens: 2 });
    expect(tracker.tokensUsed).toBe(20);
    expect(tracker.usageSeen).toBe(true);
  });
});

describe("checkBudgetTrip", () => {
  it("returns false when no maxTokens is configured, regardless of tokensUsed", () => {
    const tracker = createBudgetTracker(undefined, "stop");
    foldTrackerUsage(tracker, { inputTokens: 1000, outputTokens: 1000 });
    expect(checkBudgetTrip(tracker)).toBe(false);
    expect(tracker.stopped).toBe(false);
  });

  it("returns false while tokensUsed stays under maxTokens", () => {
    const tracker = createBudgetTracker(100, "warn");
    foldTrackerUsage(tracker, { inputTokens: 50, outputTokens: 40 });
    expect(checkBudgetTrip(tracker)).toBe(false);
    expect(tracker.exceeded).toBe(false);
  });

  it("trips exactly once: true on the crossing call, false on every later call", () => {
    const tracker = createBudgetTracker(100, "warn");
    foldTrackerUsage(tracker, { inputTokens: 60, outputTokens: 50 });
    expect(checkBudgetTrip(tracker)).toBe(true);
    expect(tracker.exceeded).toBe(true);

    foldTrackerUsage(tracker, { inputTokens: 10, outputTokens: 0 });
    expect(checkBudgetTrip(tracker)).toBe(false);
  });

  it("sets stopped only in stop mode", () => {
    const warnTracker = createBudgetTracker(10, "warn");
    foldTrackerUsage(warnTracker, { inputTokens: 10, outputTokens: 0 });
    checkBudgetTrip(warnTracker);
    expect(warnTracker.stopped).toBe(false);

    const stopTracker = createBudgetTracker(10, "stop");
    foldTrackerUsage(stopTracker, { inputTokens: 10, outputTokens: 0 });
    checkBudgetTrip(stopTracker);
    expect(stopTracker.stopped).toBe(true);
  });

  it("treats a total exactly equal to maxTokens as a trip (at or past the ceiling)", () => {
    const tracker = createBudgetTracker(50, "warn");
    foldTrackerUsage(tracker, { inputTokens: 25, outputTokens: 25 });
    expect(checkBudgetTrip(tracker)).toBe(true);
  });
});

describe("toBudgetSummary after activity", () => {
  it("reflects the tracker's live state", () => {
    const tracker = createBudgetTracker(50, "stop");
    foldTrackerUsage(tracker, { inputTokens: 30, outputTokens: 30 });
    checkBudgetTrip(tracker);
    expect(toBudgetSummary(tracker)).toEqual({
      maxTokens: 50,
      behavior: "stop",
      supported: true,
      tokensUsed: 60,
      exceeded: true,
    });
  });
});

describe("budgetExceededNotice", () => {
  it("carries the stable code and no prompt content, key, or translatable value", () => {
    const tracker = createBudgetTracker(100, "stop");
    foldTrackerUsage(tracker, { inputTokens: 60, outputTokens: 50 });
    checkBudgetTrip(tracker);

    const notice = budgetExceededNotice(tracker);
    expect(notice.code).toBe("BUDGET_TOKENS_EXCEEDED");
    expect(notice.message).toContain("100");
    expect(notice.message).toContain("110");
    expect(notice.message).toContain("stop");
  });
});
