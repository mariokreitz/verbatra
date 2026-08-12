// @vitest-environment jsdom
import { act, type ReactNode, useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ToolRegistrationFailure } from "../webmcp/registration-report.js";
import { agentToolsStatusStore, render } from "./test-support.js";
import { useAgentToolsFailures } from "./use-agent-tools-status.js";

vi.mock("./api.js", () => import("./test-support.js").then((module) => module.apiMock()));

const REFUSED: ToolRegistrationFailure = {
  tool: "verbatra_project_snapshot",
  errorName: "SecurityError",
  message: "registration refused by the browser",
};

const UNSUPPORTED: ToolRegistrationFailure = {
  tool: "verbatra_key_value",
  errorName: "InvalidStateError",
  message: "no agent surface",
};

let seen: readonly ToolRegistrationFailure[] = [];

function Probe(): ReactNode {
  seen = useAgentToolsFailures();
  return <span data-testid="count">{seen.length}</span>;
}

/**
 * Publishes during the commit phase, which lands strictly after every sibling has rendered and
 * strictly before any passive effect runs. That is the exact window a subscription registered from
 * a `useEffect` cannot cover, so it reproduces the interleaving rather than merely publishing
 * before or after the mount.
 */
function PublishDuringCommit(): ReactNode {
  useLayoutEffect(() => {
    agentToolsStatusStore.publish([REFUSED]);
  }, []);
  return null;
}

/**
 * The registration pass publishes from outside React, so the resulting re-render has to be driven
 * inside `act` the way the browser's own microtask would be.
 */
function publish(failures: readonly ToolRegistrationFailure[]): void {
  act(() => {
    agentToolsStatusStore.publish(failures);
  });
}

describe("useAgentToolsFailures", () => {
  it("starts with no failures, since the registration pass finishes after the first render", () => {
    const view = render(<Probe />);

    expect(seen).toEqual([]);
    expect(view.text()).toBe("0");
  });

  it("reads the failures the store already holds when the caller mounts late", () => {
    agentToolsStatusStore.publish([REFUSED]);

    const view = render(<Probe />);

    expect(seen).toEqual([REFUSED]);
    expect(view.text()).toBe("1");
  });

  it("re-renders with the published failures when a registration pass reports them", () => {
    const view = render(<Probe />);

    publish([REFUSED, UNSUPPORTED]);

    expect(seen).toEqual([REFUSED, UNSUPPORTED]);
    expect(view.text()).toBe("2");
  });

  it("clears back to an empty list when a later pass publishes no failure", () => {
    const view = render(<Probe />);
    publish([REFUSED]);

    publish([]);

    expect(seen).toEqual([]);
    expect(view.text()).toBe("0");
  });

  it("reflects a publish that lands between the render and the effect commit", () => {
    const view = render(
      <>
        <PublishDuringCommit />
        <Probe />
      </>,
    );

    expect(seen).toEqual([REFUSED]);
    expect(view.text()).toBe("1");
  });

  it("unsubscribes on unmount, so a later publish no longer reaches the caller", () => {
    const view = render(<Probe />);
    view.unmount();
    seen = [REFUSED];

    publish([UNSUPPORTED]);

    expect(seen).toEqual([REFUSED]);
  });
});
