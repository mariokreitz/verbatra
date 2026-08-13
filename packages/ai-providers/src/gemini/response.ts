import { ProviderError } from "../errors.js";
import type { LlmCompletion } from "../llm/run.js";
import { assertNotTruncated } from "../llm/truncation.js";
import { toUsage } from "../llm/usage.js";
import type { GeminiResponse } from "./types.js";

const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "IMAGE_SAFETY",
  "SPII",
]);

function parseContent(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned unparseable content.");
  }
}

export function extractGeminiResult(response: GeminiResponse): LlmCompletion {
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason !== undefined && blockReason !== "") {
    throw new ProviderError("PROVIDER_BLOCKED", "The provider blocked the translation request.");
  }
  const candidate = response.candidates?.[0];
  if (candidate === undefined) {
    throw new ProviderError("PROVIDER_BLOCKED", "The provider returned no candidate.");
  }
  if (candidate.finishReason !== undefined && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
    throw new ProviderError("PROVIDER_BLOCKED", "The provider filtered the translation response.");
  }
  assertNotTruncated(candidate.finishReason === "MAX_TOKENS");
  const text = response.text;
  if (text === undefined || text === "") {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no translation content.");
  }
  const raw = parseContent(text);
  const usage = toUsage(
    response.usageMetadata?.promptTokenCount,
    response.usageMetadata?.candidatesTokenCount,
  );
  return usage === undefined ? { raw } : { raw, usage };
}
