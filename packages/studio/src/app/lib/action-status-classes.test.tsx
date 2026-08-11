// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { actionStatusTextClassName, settledOutcomeTone } from "./action-status-classes.js";

describe("actionStatusTextClassName", () => {
  it("uses the success color for a success tone", () => {
    expect(actionStatusTextClassName("success")).toBe("text-xs text-success");
  });

  it("uses the danger color for a failure tone", () => {
    expect(actionStatusTextClassName("failure")).toBe("text-xs text-danger");
  });

  it("falls back to the muted color when there is no settled tone yet", () => {
    expect(actionStatusTextClassName(undefined)).toBe("text-xs text-muted-foreground");
  });

  it("keeps the type scale identical across tones, so only the color changes", () => {
    const classNames = [
      actionStatusTextClassName("success"),
      actionStatusTextClassName("failure"),
      actionStatusTextClassName(undefined),
    ];

    expect(classNames.every((className) => className.startsWith("text-xs "))).toBe(true);
  });
});

describe("settledOutcomeTone", () => {
  it("maps a success outcome to the success tone", () => {
    expect(settledOutcomeTone({ kind: "success" })).toBe("success");
  });

  it("maps an integrity rejection to the failure tone", () => {
    expect(settledOutcomeTone({ kind: "rejected", reason: "placeholder" })).toBe("failure");
  });

  it("maps an error outcome to the failure tone, so both bad endings read the same", () => {
    expect(settledOutcomeTone({ kind: "error", message: "the server refused" })).toBe("failure");
  });

  it("passes undefined through, for an action that is idle or still in flight", () => {
    expect(settledOutcomeTone(undefined)).toBeUndefined();
  });
});
