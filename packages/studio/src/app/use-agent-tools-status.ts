import { useSyncExternalStore } from "react";
import type { ToolRegistrationFailure } from "../webmcp/registration-report.js";
import { agentToolsStatusStore } from "./api.js";

export function useAgentToolsFailures(): readonly ToolRegistrationFailure[] {
  return useSyncExternalStore(agentToolsStatusStore.subscribe, agentToolsStatusStore.getFailures);
}
