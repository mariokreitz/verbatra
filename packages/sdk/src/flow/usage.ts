import type { Usage } from "@verbatra/ai-providers";
import type { UsageSummary } from "./summary.js";

export interface UsageAccumulator {
  total: UsageSummary | undefined;
}

export function createUsageAccumulator(): UsageAccumulator {
  return { total: undefined };
}

export function foldUsage(accumulator: UsageAccumulator, usage: Usage | undefined): void {
  if (usage === undefined) {
    return;
  }
  const prior = accumulator.total ?? { inputTokens: 0, outputTokens: 0 };
  accumulator.total = {
    inputTokens: prior.inputTokens + usage.inputTokens,
    outputTokens: prior.outputTokens + usage.outputTokens,
  };
}

export function combineUsage(
  a: UsageSummary | undefined,
  b: UsageSummary | undefined,
): UsageSummary | undefined {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}
