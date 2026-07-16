import type { Usage } from "@verbatra/ai-providers";
import type { UsageSummary } from "./summary.js";

/**
 * A mutable per-scope usage accumulator (one locale's main translation, one locale's plural generation,
 * or the whole run). Starts `undefined`, never `{ inputTokens: 0, outputTokens: 0 }`, so a scope where no
 * provider call ever reported usage stays honestly absent rather than fabricating a zero.
 */
export interface UsageAccumulator {
  total: UsageSummary | undefined;
}

/** Create an empty accumulator whose total starts absent. */
export function createUsageAccumulator(): UsageAccumulator {
  return { total: undefined };
}

/** Fold one provider call's usage into the accumulator. Absent usage contributes nothing. */
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

/** Combine two possibly-absent usage summaries; absent contributes nothing, both absent yields absent. */
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
