// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewOverlayEntry } from "../client/review-overlay.js";
import { render, reviewOverlayStore } from "./test-support.js";
import { useReviewOverlaySignal } from "./use-review-overlay-signal.js";

vi.mock("./api.js", () => import("./test-support.js").then((module) => module.apiMock()));

const APPROVED: ReviewOverlayEntry = { locale: "de", key: "app.title" };
const REJECTED: ReviewOverlayEntry = { locale: "fr", key: "app.subtitle" };

let seen = -1;

function Probe(): ReactNode {
  seen = useReviewOverlaySignal();
  return <span data-testid="tick">{seen}</span>;
}

/** The overlay is written by row actions outside React, so its notification has to run in `act`. */
function markActioned(entry: ReviewOverlayEntry): void {
  act(() => {
    reviewOverlayStore.markActioned(entry);
  });
}

describe("useReviewOverlaySignal", () => {
  it("starts at zero, before anything has been actioned this session", () => {
    const view = render(<Probe />);

    expect(seen).toBe(0);
    expect(view.text()).toBe("0");
  });

  it("advances the signal when a row is actioned, so the caller re-reads the store", () => {
    const view = render(<Probe />);

    markActioned(APPROVED);

    expect(view.text()).toBe("1");
  });

  it("advances once per distinct actioned row", () => {
    const view = render(<Probe />);

    markActioned(APPROVED);
    markActioned(REJECTED);

    expect(view.text()).toBe("2");
  });

  it("does not advance when the same row is actioned twice, matching the store's idempotence", () => {
    const view = render(<Probe />);

    markActioned(APPROVED);
    markActioned(APPROVED);

    expect(view.text()).toBe("1");
  });

  it("unsubscribes on unmount, so a later action no longer reaches the caller", () => {
    const view = render(<Probe />);
    view.unmount();
    seen = -1;

    markActioned(APPROVED);

    expect(seen).toBe(-1);
  });
});
