import type { ToolRegistrationFailure } from "./registration-report.js";

export interface AgentToolsStatusStore {
  getFailures(): readonly ToolRegistrationFailure[];
  publish(failures: readonly ToolRegistrationFailure[]): void;
  subscribe(listener: () => void): () => void;
}

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
