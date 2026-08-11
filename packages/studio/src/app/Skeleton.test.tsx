// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Skeleton, TableSkeleton } from "./Skeleton.js";
import { render } from "./test-support.js";

describe("Skeleton", () => {
  it("is hidden from assistive technology, because a placeholder bar carries no meaning", () => {
    const view = render(<Skeleton />);

    expect(view.get("span").getAttribute("aria-hidden")).toBe("true");
  });

  it("pulses, which is what marks the block as a placeholder rather than real content", () => {
    const view = render(<Skeleton />);

    expect(view.get("span").className).toContain("animate-pulse");
  });

  it("merges a caller className onto the base classes", () => {
    const view = render(<Skeleton className="h-10 w-1/2" />);
    const className = view.get("span").className;

    expect(className).toContain("h-10");
    expect(className).toContain("w-1/2");
    expect(className).toContain("bg-muted");
  });

  it("renders nothing but the bar itself", () => {
    const view = render(<Skeleton />);

    expect(view.text()).toBe("");
  });
});

describe("TableSkeleton", () => {
  it("defaults to a header bar plus four body bars", () => {
    const view = render(<TableSkeleton />);

    expect(view.all("span")).toHaveLength(5);
  });

  it("renders the requested number of body bars under the header bar", () => {
    const view = render(<TableSkeleton rows={7} />);

    expect(view.all("span")).toHaveLength(8);
  });

  it("still renders the header bar when no body rows are asked for", () => {
    const view = render(<TableSkeleton rows={0} />);
    const bars = view.all("span");

    expect(bars).toHaveLength(1);
    expect(bars[0]?.className).toContain("w-1/3");
  });

  it("sizes the header bar and the body bars differently, so the shape reads as a table", () => {
    const view = render(<TableSkeleton rows={1} />);
    const bars = view.all("span");

    expect(bars[0]?.className).toContain("h-6");
    expect(bars[1]?.className).toContain("h-8");
  });

  it("is not itself a live region: the caller wraps it in one so the announcement fires once", () => {
    const view = render(<TableSkeleton />);

    expect(view.get("div").getAttribute("role")).toBeNull();
  });
});
