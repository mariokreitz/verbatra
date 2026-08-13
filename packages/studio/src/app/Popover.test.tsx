// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Popover } from "./Popover.js";
import { pressKey, render } from "./test-support.js";

const PANEL_SELECTOR = "[class*='shadow-panel-lg']";

function pointerDownOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  });
}

function anchorButton(): ReactNode {
  return (
    <button type="button" id="anchor">
      Open
    </button>
  );
}

describe("Popover", () => {
  it("renders the anchor but no panel while closed", () => {
    const view = render(
      <Popover open={false} onClose={() => {}} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    expect(view.get("#anchor")).not.toBeNull();
    expect(view.query(PANEL_SELECTOR)).toBeNull();
  });

  it("renders the panel content while open", () => {
    const view = render(
      <Popover open onClose={() => {}} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    expect(view.getByText("p", "Panel body")).not.toBeNull();
  });

  it("aligns the panel to the inline start by default", () => {
    const view = render(
      <Popover open onClose={() => {}} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    expect(view.get(PANEL_SELECTOR).classList.contains("start-0")).toBe(true);
  });

  it("aligns the panel to the inline end on request", () => {
    const view = render(
      <Popover open onClose={() => {}} anchor={anchorButton()} align="end">
        <p>Panel body</p>
      </Popover>,
    );

    expect(view.get(PANEL_SELECTOR).classList.contains("end-0")).toBe(true);
  });

  it("exposes a named, non-modal dialog when the caller supplies a name", () => {
    const view = render(
      <Popover open onClose={() => {}} anchor={anchorButton()} ariaLabel="Locale filter">
        <p>Panel body</p>
      </Popover>,
    );
    const panel = view.get("[role='dialog']");

    expect(panel.getAttribute("aria-label")).toBe("Locale filter");
    expect(panel.getAttribute("aria-modal")).toBe("false");
  });

  it("stays role-less without a name, since an unnamed dialog is worse than no dialog", () => {
    const view = render(
      <Popover open onClose={() => {}} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    expect(view.query("[role='dialog']")).toBeNull();
    expect(view.get(PANEL_SELECTOR).getAttribute("aria-modal")).toBeNull();
  });

  it("dismisses on Escape", () => {
    const onClose = vi.fn();
    render(
      <Popover open onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    pressKey("Escape");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys, so typing in a field behind it does not dismiss it", () => {
    const onClose = vi.fn();
    render(
      <Popover open onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    pressKey("Enter");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("dismisses on a pointer press outside the anchor-plus-panel pair", () => {
    const onClose = vi.fn();
    render(
      <Popover open onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    pointerDownOn(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss on a pointer press inside the panel", () => {
    const onClose = vi.fn();
    const view = render(
      <Popover open onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    pointerDownOn(view.getByText("p", "Panel body"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not dismiss on a pointer press on the anchor, so the trigger can toggle itself", () => {
    const onClose = vi.fn();
    const view = render(
      <Popover open onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    pointerDownOn(view.get("#anchor"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("listens for nothing while closed, so a background click never fires onClose", () => {
    const onClose = vi.fn();
    render(
      <Popover open={false} onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    pointerDownOn(document.body);
    pressKey("Escape");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes its document listeners once it closes", () => {
    const onClose = vi.fn();
    const view = render(
      <Popover open onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    view.rerender(
      <Popover open={false} onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );
    pointerDownOn(document.body);
    pressKey("Escape");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes its document listeners on unmount", () => {
    const onClose = vi.fn();
    const view = render(
      <Popover open onClose={onClose} anchor={anchorButton()}>
        <p>Panel body</p>
      </Popover>,
    );

    view.unmount();
    pointerDownOn(document.body);
    pressKey("Escape");

    expect(onClose).not.toHaveBeenCalled();
  });
});
