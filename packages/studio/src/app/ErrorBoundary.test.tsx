// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { click, render } from "./test-support.js";

/**
 * React logs every error it hands to a boundary through `console.error`, and
 * `componentDidCatch` logs a second time. Silencing it keeps the throwing tests
 * from burying real output, and returns the spy so a test can read what was
 * reported.
 *
 * This is the one piece of setup specific to this file. Every other suite here
 * renders components that do not throw, so the shared harness in
 * `test-support.tsx` has no reason to carry it.
 */
function silenceConsoleError(): MockInstance<typeof console.error> {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

// Deliberate: the shared preset does not set `restoreMocks`, so the console spy
// installed above would stay in place for the rest of the file without this.
afterEach(() => {
  vi.restoreAllMocks();
});

function Exploding(): ReactNode {
  throw new Error("panel blew up");
}

describe("ErrorBoundary", () => {
  it("renders a visible notice instead of a blank container when a child throws", () => {
    silenceConsoleError();

    const view = render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(view.container.innerHTML).not.toBe("");
    expect(view.text()).toContain("Something went wrong");
  });

  it("announces the notice with role=alert", () => {
    silenceConsoleError();

    const view = render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    const alert = view.query('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("Something went wrong");
  });

  it("surfaces the thrown message so the fault can be diagnosed", () => {
    silenceConsoleError();

    const view = render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(view.text()).toContain("panel blew up");
  });

  it("offers a recovery action that is present and operable", () => {
    silenceConsoleError();
    const reload = vi.fn();

    const view = render(
      <ErrorBoundary reload={reload}>
        <Exploding />
      </ErrorBoundary>,
    );

    const button = view.get("button");
    expect(button.textContent).toBe("Reload the dashboard");

    click(button);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reports the caught error to the console", () => {
    const spy = silenceConsoleError();

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    const reported = spy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("caught by the error boundary"),
    );
    expect(reported).toBe(true);
  });

  it("renders a non-Error throw with fallback copy rather than blank text", () => {
    silenceConsoleError();

    function ThrowsAString(): ReactNode {
      throw "just a string";
    }

    const view = render(
      <ErrorBoundary>
        <ThrowsAString />
      </ErrorBoundary>,
    );

    expect(view.text()).toContain("just a string");
  });

  it("falls back to generic copy when the thrown value carries no message", () => {
    silenceConsoleError();

    function ThrowsNothingUseful(): ReactNode {
      throw new Error("");
    }

    const view = render(
      <ErrorBoundary>
        <ThrowsNothingUseful />
      </ErrorBoundary>,
    );

    expect(view.text()).toContain("An unknown error was thrown during render.");
  });

  it("renders a non-throwing child unchanged and stays out of the way", () => {
    const view = render(
      <ErrorBoundary>
        <p data-testid="child">all good</p>
      </ErrorBoundary>,
    );

    expect(view.query('[data-testid="child"]')?.textContent).toBe("all good");
    expect(view.query('[role="alert"]')).toBeNull();
    expect(view.query("button")).toBeNull();
  });
});
