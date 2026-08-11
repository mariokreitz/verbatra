// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Loading } from "./Loading.js";
import { render } from "./test-support.js";

describe("Loading", () => {
  it("announces itself as a status region, so a screen reader hears the wait", () => {
    const view = render(<Loading />);

    expect(view.get("p").getAttribute("role")).toBe("status");
  });

  it("renders the visible waiting copy", () => {
    const view = render(<Loading />);

    expect(view.text()).toBe("Loading...");
  });

  it("hides the spinner from assistive technology, so the copy is announced once", () => {
    const view = render(<Loading />);

    expect(view.get("span").getAttribute("aria-hidden")).toBe("true");
  });

  it("spins the indicator, which is the only signal that work is still in flight", () => {
    const view = render(<Loading />);

    expect(view.get("span").className).toContain("animate-spin");
  });
});
