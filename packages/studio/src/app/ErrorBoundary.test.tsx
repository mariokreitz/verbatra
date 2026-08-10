// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.js";

// React reads this flag to decide whether `act` is legal in this environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

function render(node: ReactNode): void {
  act(() => {
    root.render(node);
  });
}

/**
 * React logs every error it hands to a boundary through `console.error`, and
 * `componentDidCatch` logs a second time. Silencing it keeps the throwing tests
 * from burying real output, and returns the spy so a test can read what was
 * reported.
 */
function silenceConsoleError(): MockInstance<typeof console.error> {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

function Exploding(): ReactNode {
  throw new Error("panel blew up");
}

describe("ErrorBoundary", () => {
  it("renders a visible notice instead of a blank container when a child throws", () => {
    silenceConsoleError();

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(container.innerHTML).not.toBe("");
    expect(container.textContent).toContain("Something went wrong");
  });

  it("announces the notice with role=alert", () => {
    silenceConsoleError();

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("Something went wrong");
  });

  it("surfaces the thrown message so the fault can be diagnosed", () => {
    silenceConsoleError();

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(container.textContent).toContain("panel blew up");
  });

  it("offers a recovery action that is present and operable", () => {
    silenceConsoleError();
    const reload = vi.fn();

    render(
      <ErrorBoundary reload={reload}>
        <Exploding />
      </ErrorBoundary>,
    );

    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Reload the dashboard");

    act(() => {
      button?.click();
    });

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

    render(
      <ErrorBoundary>
        <ThrowsAString />
      </ErrorBoundary>,
    );

    expect(container.textContent).toContain("just a string");
  });

  it("falls back to generic copy when the thrown value carries no message", () => {
    silenceConsoleError();

    function ThrowsNothingUseful(): ReactNode {
      throw new Error("");
    }

    render(
      <ErrorBoundary>
        <ThrowsNothingUseful />
      </ErrorBoundary>,
    );

    expect(container.textContent).toContain("An unknown error was thrown during render.");
  });

  it("renders a non-throwing child unchanged and stays out of the way", () => {
    render(
      <ErrorBoundary>
        <p data-testid="child">all good</p>
      </ErrorBoundary>,
    );

    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("all good");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});
