import type { ReactNode } from "react";
import type { ToolRegistrationFailure } from "../webmcp/registration-report.js";
import { Icon } from "./Icon.js";

/** Props for {@link AgentToolsAlert}. */
export interface AgentToolsAlertProps {
  readonly failures: readonly ToolRegistrationFailure[];
}

/**
 * The degraded-mode notice for the opt-in agent-tools surface: it renders only when a tool
 * registration failed, so a dashboard whose surface is off, or on and healthy, shows nothing at
 * all. The copy carries the count and the first error name, enough to tell what happened without
 * repeating the per-tool detail the console already carries in full. Styled and announced like the
 * dashboard's other error surfaces, with `role="alert"`; the glyph is decorative.
 */
export function AgentToolsAlert({ failures }: AgentToolsAlertProps): ReactNode {
  const first = failures.at(0);
  if (first === undefined) {
    return null;
  }
  return (
    <p
      className="mb-4 flex items-start gap-2 rounded-md border-s-[3px] border-warning bg-warning-soft px-4 py-3 text-warning"
      role="alert"
    >
      <Icon name="alert" className="mt-0.5 flex-none" />
      <span>
        Agent tools degraded: {failures.length} of the agent tool registrations failed with{" "}
        {first.errorName}. The dashboard itself is unaffected. The browser console lists every
        failing tool.
      </span>
    </p>
  );
}
