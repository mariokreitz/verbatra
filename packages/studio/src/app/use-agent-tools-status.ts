import { useEffect, useState } from "react";
import type { ToolRegistrationFailure } from "../webmcp/registration-report.js";
import { agentToolsStatusStore } from "./api.js";

/**
 * Subscribes to the shared {@link agentToolsStatusStore} and re-renders the caller when the
 * agent-tools registration pass publishes its outcome, which happens after the first render. The
 * returned list is empty unless a registration failed.
 */
export function useAgentToolsFailures(): readonly ToolRegistrationFailure[] {
  const [failures, setFailures] = useState<readonly ToolRegistrationFailure[]>(() =>
    agentToolsStatusStore.getFailures(),
  );

  useEffect(
    () => agentToolsStatusStore.subscribe(() => setFailures(agentToolsStatusStore.getFailures())),
    [],
  );

  return failures;
}
