import { useSyncExternalStore } from "react";
import type { ToolRegistrationFailure } from "../webmcp/registration-report.js";
import { agentToolsStatusStore } from "./api.js";

/**
 * Reads the shared {@link agentToolsStatusStore} and re-renders the caller when the agent-tools
 * registration pass publishes its outcome, which happens after the first render. The returned list
 * is empty unless a registration failed.
 *
 * `useSyncExternalStore` rather than a seeded `useState` plus a subscribing `useEffect`: React
 * schedules passive effects asynchronously, so a publish landing between the render and the effect
 * commit would be seeded past and never notified, and the degraded-mode notice would silently stay
 * hidden. React re-reads the snapshot when it registers the subscription, which closes that window
 * by construction instead of narrowing it. The store's `getFailures` returns the stored list by
 * reference, so the snapshot is stable between publishes.
 */
export function useAgentToolsFailures(): readonly ToolRegistrationFailure[] {
  return useSyncExternalStore(agentToolsStatusStore.subscribe, agentToolsStatusStore.getFailures);
}
