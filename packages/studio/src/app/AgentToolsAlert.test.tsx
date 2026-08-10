import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ToolRegistrationFailure } from "../webmcp/registration-report.js";
import { AgentToolsAlert } from "./AgentToolsAlert.js";

const FAILURES: readonly ToolRegistrationFailure[] = [
  { tool: "verbatra_project_snapshot", errorName: "SecurityError", message: "refused" },
  { tool: "verbatra_key_value", errorName: "SecurityError", message: "refused" },
];

describe("AgentToolsAlert", () => {
  it("renders nothing when no registration failed", () => {
    expect(renderToStaticMarkup(<AgentToolsAlert failures={[]} />)).toBe("");
  });

  it("renders a degraded-mode notice carrying the failure count and the error name", () => {
    const markup = renderToStaticMarkup(<AgentToolsAlert failures={FAILURES} />);

    expect(markup).not.toBe("");
    expect(markup).toContain("Agent tools degraded");
    expect(markup).toContain("2 of the agent tool registrations failed");
    expect(markup).toContain("SecurityError");
  });

  it("announces the notice with role=alert, as the other error surfaces do", () => {
    expect(renderToStaticMarkup(<AgentToolsAlert failures={FAILURES} />)).toContain('role="alert"');
  });
});
