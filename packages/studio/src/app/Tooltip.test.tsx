// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip.js";
import { render } from "./test-support.js";

describe("Tooltip", () => {
  it("renders the wrapped control alongside the bubble", () => {
    const view = render(
      <Tooltip label="Copy the key">
        <button type="button" aria-label="Copy the key">
          c
        </button>
      </Tooltip>,
    );

    expect(view.get("button").getAttribute("aria-label")).toBe("Copy the key");
  });

  it("shows the label text in the bubble", () => {
    const view = render(
      <Tooltip label="Copy the key">
        <button type="button">c</button>
      </Tooltip>,
    );

    expect(view.getByText("span", "Copy the key").textContent).toBe("Copy the key");
  });

  it("hides the bubble from assistive technology, since it duplicates the control's own name", () => {
    const view = render(
      <Tooltip label="Copy the key">
        <button type="button">c</button>
      </Tooltip>,
    );

    expect(view.get("span[aria-hidden]").getAttribute("aria-hidden")).toBe("true");
  });

  it("sits at the inline-end edge by default", () => {
    const view = render(
      <Tooltip label="Reload">
        <button type="button">r</button>
      </Tooltip>,
    );
    const className = view.get("span[aria-hidden]").className;

    expect(className).toContain("start-full");
    expect(className).toContain("-translate-y-1/2");
  });

  it("sits below the control when the bottom side is asked for", () => {
    const view = render(
      <Tooltip label="Reload" side="bottom">
        <button type="button">r</button>
      </Tooltip>,
    );
    const className = view.get("span[aria-hidden]").className;

    expect(className).toContain("top-full");
    expect(className).toContain("-translate-x-1/2");
    expect(className).not.toContain("start-full");
  });

  it("starts invisible and reveals on hover or focus within the group, with no open state", () => {
    const view = render(
      <Tooltip label="Reload">
        <button type="button">r</button>
      </Tooltip>,
    );
    const className = view.get("span[aria-hidden]").className;

    expect(className).toContain("opacity-0");
    expect(className).toContain("group-hover/tooltip:opacity-100");
    expect(className).toContain("group-focus-within/tooltip:opacity-100");
  });

  it("never swallows a pointer event aimed at the control beneath it", () => {
    const view = render(
      <Tooltip label="Reload">
        <button type="button">r</button>
      </Tooltip>,
    );

    expect(view.get("span[aria-hidden]").className).toContain("pointer-events-none");
  });
});
