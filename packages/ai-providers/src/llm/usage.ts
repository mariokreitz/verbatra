import type { Usage } from "../provider.js";

export function toUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): Usage | undefined {
  if (typeof inputTokens !== "number" || typeof outputTokens !== "number") {
    return undefined;
  }
  return { inputTokens, outputTokens };
}
