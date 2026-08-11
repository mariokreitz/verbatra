// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { pressKey, render } from "./test-support.js";
import { useDialogA11y } from "./use-dialog-a11y.js";

interface DialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** False leaves the returned ref unattached, the way a caller that forgot to wire it would. */
  readonly attachRef?: boolean;
  readonly children?: ReactNode;
}

function Dialog({ isOpen, onClose, attachRef = true, children }: DialogProps): ReactNode {
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen, onClose });
  return (
    <div ref={attachRef ? containerRef : null} data-testid="dialog">
      {children}
    </div>
  );
}

/** Three real, focusable controls: jsdom only moves focus to elements attached to the document. */
const CONTENT: ReactNode = (
  <>
    <button type="button" id="first">
      First
    </button>
    <input id="middle" aria-label="Middle" />
    <button type="button" id="last">
      Last
    </button>
  </>
);

describe("useDialogA11y", () => {
  it("moves focus to the first focusable element when the dialog opens", () => {
    const view = render(
      <Dialog isOpen onClose={vi.fn()}>
        {CONTENT}
      </Dialog>,
    );

    expect(document.activeElement).toBe(view.get("#first"));
  });

  it("calls onClose on Escape, leaving the unmounting to the caller", () => {
    const onClose = vi.fn();
    const view = render(
      <Dialog isOpen onClose={onClose}>
        {CONTENT}
      </Dialog>,
    );

    pressKey("Escape");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.query("#first")).not.toBeNull();
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    const view = render(
      <Dialog isOpen onClose={vi.fn()}>
        {CONTENT}
      </Dialog>,
    );
    view.get("#last").focus();

    pressKey("Tab");

    expect(document.activeElement).toBe(view.get("#first"));
  });

  it("wraps Shift+Tab from the first focusable element back to the last", () => {
    const view = render(
      <Dialog isOpen onClose={vi.fn()}>
        {CONTENT}
      </Dialog>,
    );

    pressKey("Tab", { shiftKey: true });

    expect(document.activeElement).toBe(view.get("#last"));
  });

  it("leaves a Tab in the middle of the dialog to the browser's own order", () => {
    const view = render(
      <Dialog isOpen onClose={vi.fn()}>
        {CONTENT}
      </Dialog>,
    );
    const middle = view.get("#middle");
    middle.focus();

    pressKey("Tab");

    expect(document.activeElement).toBe(middle);
  });

  it("does nothing on Tab when the dialog holds no focusable element", () => {
    render(
      <Dialog isOpen onClose={vi.fn()}>
        <p>Nothing to focus here.</p>
      </Dialog>,
    );
    const before = document.activeElement;

    pressKey("Tab");

    expect(document.activeElement).toBe(before);
  });

  it("still closes on Escape when the container ref was never attached", () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen onClose={onClose} attachRef={false}>
        {CONTENT}
      </Dialog>,
    );
    const before = document.activeElement;

    pressKey("Tab");
    pressKey("Escape");

    expect(document.activeElement).toBe(before);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("installs nothing while the dialog is closed", () => {
    const onClose = vi.fn();
    const view = render(
      <Dialog isOpen={false} onClose={onClose}>
        {CONTENT}
      </Dialog>,
    );

    pressKey("Escape");

    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(view.get("#first"));
  });

  it("returns focus to the element focused before opening when the dialog closes", () => {
    const onClose = vi.fn();
    const closed = (
      <>
        <button type="button" id="opener">
          Open
        </button>
        <Dialog isOpen={false} onClose={onClose}>
          {CONTENT}
        </Dialog>
      </>
    );
    const view = render(closed);
    const opener = view.get("#opener");
    opener.focus();

    view.rerender(
      <>
        <button type="button" id="opener">
          Open
        </button>
        <Dialog isOpen onClose={onClose}>
          {CONTENT}
        </Dialog>
      </>,
    );
    expect(document.activeElement).toBe(view.get("#first"));
    view.rerender(closed);

    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the element focused before opening when the dialog unmounts", () => {
    // The opener lives outside the React root on purpose: unmounting removes the root's own DOM,
    // which would leave focus falling back to the body no matter what the hook did.
    const opener = document.createElement("button");
    opener.type = "button";
    document.body.appendChild(opener);
    opener.focus();
    const view = render(
      <Dialog isOpen onClose={vi.fn()}>
        {CONTENT}
      </Dialog>,
    );
    expect(document.activeElement).toBe(view.get("#first"));

    view.unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("calls the callback from the latest render, not the one the trap was built with", () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(
      <Dialog isOpen onClose={first}>
        {CONTENT}
      </Dialog>,
    );

    view.rerender(
      <Dialog isOpen onClose={second}>
        {CONTENT}
      </Dialog>,
    );
    pressKey("Escape");

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
