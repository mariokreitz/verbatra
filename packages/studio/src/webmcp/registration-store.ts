import type { ToolRegistrationFailure } from "./registration-report.js";

/**
 * The bridge from the registration pass, which finishes after the dashboard has already mounted,
 * to whatever renders the degraded-mode notice. A plain synchronous in-memory store in the same
 * shape as the app's other shared stores: no transport, no persistence, and it resets on reload.
 */
export interface AgentToolsStatusStore {
  /** The failures published so far; empty both before a pass finishes and after a clean one. */
  getFailures(): readonly ToolRegistrationFailure[];
  /** Records a finished pass. Publishing nothing onto nothing notifies no one. */
  publish(failures: readonly ToolRegistrationFailure[]): void;
  /** Registers a listener called after a change; returns a function that unregisters it. */
  subscribe(listener: () => void): () => void;
}

/** Creates a fresh {@link AgentToolsStatusStore} with no failures recorded. */
export function createAgentToolsStatusStore(): AgentToolsStatusStore {
  let failures: readonly ToolRegistrationFailure[] = [];
  const listeners = new Set<() => void>();

  return {
    getFailures: (): readonly ToolRegistrationFailure[] => failures,
    publish(next: readonly ToolRegistrationFailure[]): void {
      if (next.length === 0 && failures.length === 0) {
        return;
      }
      failures = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
