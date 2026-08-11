// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cn } from "./cn.js";

describe("cn", () => {
  it("joins plain class names in order", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("drops falsy entries, so a `condition && class` reads as absent rather than as 'false'", () => {
    expect(cn("flex", false && "hidden", undefined, null, "")).toBe("flex");
  });

  it("accepts arrays and objects, the conditional forms callers pass", () => {
    expect(cn(["flex", "gap-2"], { truncate: true, hidden: false })).toBe("flex gap-2 truncate");
  });

  it("lets the last of two conflicting Tailwind utilities win, so a caller className overrides", () => {
    expect(cn("px-2 py-1", "px-6")).toBe("py-1 px-6");
  });

  it("keeps utilities from different groups side by side rather than treating them as a conflict", () => {
    expect(cn("text-sm text-danger")).toBe("text-sm text-danger");
  });

  it("returns an empty string when nothing survives, so the attribute stays harmless", () => {
    expect(cn(undefined, false)).toBe("");
  });
});
